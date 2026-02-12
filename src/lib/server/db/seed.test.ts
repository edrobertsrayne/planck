import { describe, it, expect, beforeEach } from 'vitest';
import { seedExamSpecs } from './seed';
import { db } from './index';
import {
	examSpec,
	topic,
	specPoint,
	scheduledLessonSpecPoint,
	scheduledLesson,
	moduleAssignment,
	timetableSlot,
	timetableConfig,
	lessonSpecPoint,
	lesson,
	module,
	calendarEvent,
	teachingClass
} from './schema';
import { eq, and } from 'drizzle-orm';

describe('seedExamSpecs', () => {
	beforeEach(async () => {
		// Clear all data in foreign key dependency order
		await db.delete(scheduledLessonSpecPoint);
		await db.delete(scheduledLesson);
		await db.delete(moduleAssignment);
		await db.delete(timetableSlot);
		await db.delete(timetableConfig);
		await db.delete(lessonSpecPoint);
		await db.delete(lesson);
		await db.delete(module);
		await db.delete(calendarEvent);
		await db.delete(specPoint);
		await db.delete(topic);
		await db.delete(teachingClass);
		await db.delete(examSpec);
	});

	it('should create all GCSE exam specifications', async () => {
		await seedExamSpecs();

		const gcseSpecs = await db.select().from(examSpec).where(eq(examSpec.level, 'GCSE'));

		// Should have 5 GCSE specifications: AQA, OCR Gateway, OCR 21st Century, Edexcel, WJEC/Eduqas
		expect(gcseSpecs).toHaveLength(5);

		const boards = gcseSpecs.map((spec) => spec.board).sort();
		expect(boards).toEqual(['AQA', 'Edexcel', 'OCR 21st Century', 'OCR Gateway', 'WJEC/Eduqas']);
	});

	it('should create all A-Level exam specifications', async () => {
		await seedExamSpecs();

		const aLevelSpecs = await db.select().from(examSpec).where(eq(examSpec.level, 'A-Level'));

		// Should have 5 A-Level specifications: AQA, OCR A, OCR B, Edexcel, WJEC/Eduqas
		expect(aLevelSpecs).toHaveLength(5);

		const boards = aLevelSpecs.map((spec) => spec.board).sort();
		expect(boards).toEqual(['AQA', 'Edexcel', 'OCR A', 'OCR B', 'WJEC/Eduqas']);
	});

	it('should create topics for each exam specification', async () => {
		await seedExamSpecs();

		const specs = await db.select().from(examSpec);
		expect(specs.length).toBeGreaterThan(0);

		// Check that each specification has at least one topic
		for (const spec of specs) {
			const topics = await db.select().from(topic).where(eq(topic.examSpecId, spec.id));
			expect(
				topics.length,
				`Expected spec ${spec.name} to have topics, but found none`
			).toBeGreaterThan(0);
		}
	});

	it('should create hierarchical topic structure', async () => {
		await seedExamSpecs();

		// Get one spec to check hierarchical structure
		const aqaGcse = await db
			.select()
			.from(examSpec)
			.where(and(eq(examSpec.board, 'AQA'), eq(examSpec.level, 'GCSE')))
			.limit(1);

		expect(aqaGcse).toHaveLength(1);

		const topics = await db.select().from(topic).where(eq(topic.examSpecId, aqaGcse[0].id));

		// Should have both root topics (parentId is null) and child topics (parentId is set)
		const rootTopics = topics.filter((t) => t.parentId === null);
		const childTopics = topics.filter((t) => t.parentId !== null);

		expect(rootTopics.length).toBeGreaterThan(0);
		expect(childTopics.length).toBeGreaterThan(0);

		// Verify child topics reference valid parent IDs
		const parentIds = new Set(topics.map((t) => t.id));
		for (const child of childTopics) {
			expect(parentIds.has(child.parentId!)).toBe(true);
		}
	});

	it('should create spec points with references and content', async () => {
		await seedExamSpecs();

		const specs = await db.select().from(examSpec).limit(1);
		expect(specs).toHaveLength(1);

		const topics = await db.select().from(topic).where(eq(topic.examSpecId, specs[0].id));
		expect(topics.length).toBeGreaterThan(0);

		const specPoints = await db.select().from(specPoint).where(eq(specPoint.topicId, topics[0].id));

		expect(specPoints.length).toBeGreaterThan(0);

		// Check that spec points have required fields
		for (const point of specPoints) {
			expect(point.reference).toBeTruthy();
			expect(point.content).toBeTruthy();
			expect(point.reference).toMatch(/^\d+(\.\d+)*$/); // Should match pattern like "4.1.1.2"
		}
	});

	it('should assign topics a sort order for sequencing', async () => {
		await seedExamSpecs();

		const specs = await db.select().from(examSpec).limit(1);
		const topics = await db.select().from(topic).where(eq(topic.examSpecId, specs[0].id));

		// All topics should have a sortOrder defined
		for (const t of topics) {
			expect(typeof t.sortOrder).toBe('number');
		}
	});

	it('should assign spec points a sort order for sequencing', async () => {
		await seedExamSpecs();

		const topics = await db.select().from(topic).limit(1);
		const points = await db.select().from(specPoint).where(eq(specPoint.topicId, topics[0].id));

		// All spec points should have a sortOrder defined
		for (const point of points) {
			expect(typeof point.sortOrder).toBe('number');
		}
	});

	it('should not create duplicate specifications on multiple runs', async () => {
		await seedExamSpecs();
		const firstRun = await db.select().from(examSpec);

		await seedExamSpecs();
		const secondRun = await db.select().from(examSpec);

		// Should have the same number of specs after running twice
		expect(secondRun).toHaveLength(firstRun.length);
	});
});
