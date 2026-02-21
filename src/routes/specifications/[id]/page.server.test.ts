/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck - Test file with mock types for SvelteKit server functions
import { describe, it, expect, beforeEach } from 'vitest';
import { load } from './+page.server.js';
import { db } from '$lib/server/db';
import {
	examSpec,
	topic,
	specPoint,
	module,
	lesson,
	lessonSpecPoint,
	scheduledLessonSpecPoint,
	scheduledLesson,
	moduleAssignment,
	timetableSlot,
	timetableConfig,
	calendarEvent,
	teachingClass
} from '$lib/server/db/schema';
import type { RequestEvent } from '@sveltejs/kit';

describe('Specification Detail Page Server', () => {
	let testSpec: { id: string };
	let testTopic: { id: string };
	let testSubTopic: { id: string };
	let testSpecPoint: { id: string };
	let testModule: { id: string };
	let testLesson: { id: string };

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

		// Create test exam spec
		const specs = await db
			.insert(examSpec)
			.values({
				board: 'AQA',
				level: 'GCSE',
				name: 'AQA GCSE Physics (8463)',
				specCode: '8463',
				specYear: '2018'
			})
			.returning();
		testSpec = specs[0];

		// Create test topic
		const topics = await db
			.insert(topic)
			.values({
				examSpecId: testSpec.id,
				parentId: null,
				name: 'Energy',
				code: '4.1',
				description: 'Energy stores and transfers',
				sortOrder: 1
			})
			.returning();
		testTopic = topics[0];

		// Create test subtopic
		const subTopics = await db
			.insert(topic)
			.values({
				examSpecId: testSpec.id,
				parentId: testTopic.id,
				name: 'Energy stores',
				code: '4.1.1',
				description: 'Different energy stores',
				sortOrder: 1
			})
			.returning();
		testSubTopic = subTopics[0];

		// Create test spec point
		const specPoints = await db
			.insert(specPoint)
			.values({
				topicId: testTopic.id,
				reference: '4.1.1.1',
				content: 'Describe all the changes involved in the way energy is stored',
				tier: 'both',
				sortOrder: 1
			})
			.returning();
		testSpecPoint = specPoints[0];

		// Create test module
		const modules = await db
			.insert(module)
			.values({
				name: 'Energy Module',
				description: 'Introduction to energy',
				targetSpecId: testSpec.id
			})
			.returning();
		testModule = modules[0];

		// Create test lesson
		const lessons = await db
			.insert(lesson)
			.values({
				moduleId: testModule.id,
				title: 'Energy Stores',
				content: 'Introduction to energy stores',
				duration: 1,
				order: 1
			})
			.returning();
		testLesson = lessons[0];

		// Link lesson to spec point
		await db.insert(lessonSpecPoint).values({
			lessonId: testLesson.id,
			specPointId: testSpecPoint.id
		});
	});

	describe('load function', () => {
		it('should redirect to specifications list when specification not found', async () => {
			try {
				await load({
					params: { id: 'non-existent-id' }
				} as RequestEvent);
				// Should not reach here
				expect(true).toBe(false);
			} catch (error) {
				// SvelteKit redirect throws a special redirect object with status and location
				expect(error).toHaveProperty('status', 303);
				expect(error).toHaveProperty('location', '/specifications');
			}
		});

		it('should return specification details', async () => {
			const result = await load({
				params: { id: testSpec.id }
			} as RequestEvent);

			expect(result.spec.id).toBe(testSpec.id);
			expect(result.spec.board).toBe('AQA');
			expect(result.spec.level).toBe('GCSE');
			expect(result.spec.name).toBe('AQA GCSE Physics (8463)');
		});

		it('should return root topics with hierarchical structure', async () => {
			const result = await load({
				params: { id: testSpec.id }
			} as RequestEvent);

			expect(result.topics).toHaveLength(1);
			expect(result.topics[0].id).toBe(testTopic.id);
			expect(result.topics[0].name).toBe('Energy');
			expect(result.topics[0].code).toBe('4.1');
			expect(result.topics[0].children).toHaveLength(1);
			expect(result.topics[0].children[0].id).toBe(testSubTopic.id);
		});

		it('should include spec points in topics', async () => {
			const result = await load({
				params: { id: testSpec.id }
			} as RequestEvent);

			expect(result.topics[0].specPoints).toHaveLength(1);
			expect(result.topics[0].specPoints[0].id).toBe(testSpecPoint.id);
			expect(result.topics[0].specPoints[0].reference).toBe('4.1.1.1');
			expect(result.topics[0].specPoints[0].content).toBe(
				'Describe all the changes involved in the way energy is stored'
			);
		});

		it('should include linked lessons in spec points', async () => {
			const result = await load({
				params: { id: testSpec.id }
			} as RequestEvent);

			const linkedLessons = result.topics[0].specPoints[0].linkedLessons;
			expect(linkedLessons).toHaveLength(1);
			expect(linkedLessons[0].lessonId).toBe(testLesson.id);
			expect(linkedLessons[0].lessonTitle).toBe('Energy Stores');
			expect(linkedLessons[0].moduleId).toBe(testModule.id);
			expect(linkedLessons[0].moduleName).toBe('Energy Module');
		});

		it('should handle topics without spec points', async () => {
			const result = await load({
				params: { id: testSpec.id }
			} as RequestEvent);

			expect(result.topics[0].children[0].specPoints).toEqual([]);
		});

		it('should handle topics without linked lessons', async () => {
			// Clean all lesson links
			await db.delete(lessonSpecPoint);

			const result = await load({
				params: { id: testSpec.id }
			} as RequestEvent);

			expect(result.topics[0].specPoints[0].linkedLessons).toEqual([]);
		});

		it('should order spec points by sortOrder and reference', async () => {
			// Add more spec points
			await db.insert(specPoint).values([
				{
					topicId: testTopic.id,
					reference: '4.1.1.3',
					content: 'Third spec point',
					tier: 'both',
					sortOrder: 3
				},
				{
					topicId: testTopic.id,
					reference: '4.1.1.2',
					content: 'Second spec point',
					tier: 'both',
					sortOrder: 2
				}
			]);

			const result = await load({
				params: { id: testSpec.id }
			} as RequestEvent);

			expect(result.topics[0].specPoints).toHaveLength(3);
			expect(result.topics[0].specPoints[0].reference).toBe('4.1.1.1');
			expect(result.topics[0].specPoints[1].reference).toBe('4.1.1.2');
			expect(result.topics[0].specPoints[2].reference).toBe('4.1.1.3');
		});
	});
});
