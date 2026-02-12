import { db } from '$lib/server/db';
import {
	examSpec,
	topic,
	specPoint,
	lessonSpecPoint,
	lesson,
	module,
	scheduledLesson,
	moduleAssignment
} from '$lib/server/db/schema';
import { eq, sql, asc } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const specId = params.id;

	// Get the exam specification
	const [spec] = await db.select().from(examSpec).where(eq(examSpec.id, specId)).limit(1);

	if (!spec) {
		throw error(404, 'Specification not found');
	}

	// Get all topics for this specification (with parent relationship)
	const topics = await db
		.select({
			id: topic.id,
			examSpecId: topic.examSpecId,
			parentId: topic.parentId,
			name: topic.name,
			code: topic.code,
			description: topic.description,
			sortOrder: topic.sortOrder
		})
		.from(topic)
		.where(eq(topic.examSpecId, specId))
		.orderBy(asc(topic.sortOrder), asc(topic.name));

	// Get all spec points for this specification
	const specPoints = await db
		.select({
			id: specPoint.id,
			topicId: specPoint.topicId,
			reference: specPoint.reference,
			content: specPoint.content,
			notes: specPoint.notes,
			tier: specPoint.tier,
			sortOrder: specPoint.sortOrder
		})
		.from(specPoint)
		.innerJoin(topic, eq(specPoint.topicId, topic.id))
		.where(eq(topic.examSpecId, specId))
		.orderBy(asc(specPoint.sortOrder), asc(specPoint.reference));

	// Get linked lessons for each spec point (from lesson templates)
	const linkedLessons = await db
		.select({
			specPointId: lessonSpecPoint.specPointId,
			lessonId: lesson.id,
			lessonTitle: lesson.title,
			moduleId: module.id,
			moduleName: module.name
		})
		.from(lessonSpecPoint)
		.innerJoin(lesson, eq(lessonSpecPoint.lessonId, lesson.id))
		.innerJoin(module, eq(lesson.moduleId, module.id))
		.innerJoin(specPoint, eq(lessonSpecPoint.specPointId, specPoint.id))
		.innerJoin(topic, eq(specPoint.topicId, topic.id))
		.where(eq(topic.examSpecId, specId));

	// Count how many classes are using each lesson (via scheduled lessons)
	const scheduledLessonUsage = await db
		.select({
			lessonId: scheduledLesson.lessonId,
			classCount: sql<number>`count(distinct ${moduleAssignment.classId})`.as('class_count')
		})
		.from(scheduledLesson)
		.innerJoin(moduleAssignment, eq(scheduledLesson.assignmentId, moduleAssignment.id))
		.innerJoin(lesson, eq(scheduledLesson.lessonId, lesson.id))
		.innerJoin(module, eq(lesson.moduleId, module.id))
		.where(eq(module.targetSpecId, specId))
		.groupBy(scheduledLesson.lessonId);

	// Create lookup maps for easier data access
	const specPointsMap = new Map(
		specPoints.map((sp) => [
			sp.id,
			{
				...sp,
				linkedLessons: [] as Array<{
					lessonId: string;
					lessonTitle: string;
					moduleId: string;
					moduleName: string;
				}>
			}
		])
	);

	// Add linked lessons to spec points
	for (const link of linkedLessons) {
		const sp = specPointsMap.get(link.specPointId);
		if (sp) {
			sp.linkedLessons.push({
				lessonId: link.lessonId,
				lessonTitle: link.lessonTitle,
				moduleId: link.moduleId,
				moduleName: link.moduleName
			});
		}
	}

	const usageMap = new Map(scheduledLessonUsage.map((u) => [u.lessonId, u.classCount]));

	// Define type for enriched topic with children and spec points
	type EnrichedTopic = (typeof topics)[number] & {
		children: EnrichedTopic[];
		specPoints: NonNullable<ReturnType<typeof specPointsMap.get>>[];
	};

	// Build hierarchical topic structure
	const topicMap = new Map<string, EnrichedTopic>();

	// First pass: create all topics with empty children and spec points
	for (const t of topics) {
		topicMap.set(t.id, {
			...t,
			children: [],
			specPoints: specPoints
				.filter((sp) => sp.topicId === t.id)
				.map((sp) => specPointsMap.get(sp.id)!)
		});
	}

	// Second pass: build parent-child relationships
	const rootTopics: EnrichedTopic[] = [];
	for (const t of topics) {
		const currentTopic = topicMap.get(t.id)!;

		if (t.parentId === null) {
			rootTopics.push(currentTopic);
		} else {
			const parent = topicMap.get(t.parentId);
			if (parent) {
				parent.children.push(currentTopic);
			}
		}
	}

	return {
		spec,
		topics: rootTopics,
		usageMap: Object.fromEntries(usageMap)
	};
};
