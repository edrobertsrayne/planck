/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck - Test file with mock types for SvelteKit server functions
import { describe, it, expect, beforeEach } from 'vitest';
import { load, actions } from './+page.server.js';
import { db } from '$lib/server/db';
import {
	module,
	lesson,
	examSpec,
	specPoint,
	topic,
	lessonSpecPoint,
	scheduledLesson,
	scheduledLessonSpecPoint,
	moduleAssignment,
	teachingClass
} from '$lib/server/db/schema';
import { eq, asc } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';

describe('Module Editor Page Server', () => {
	let testModule: { id: string };
	let testExamSpec: { id: string };
	let testTopic: { id: string };
	let testSpecPoint1: { id: string };
	let testSpecPoint2: { id: string };

	beforeEach(async () => {
		// Clean up test data in correct order (children first, parents last)
		await db.delete(scheduledLessonSpecPoint);
		await db.delete(scheduledLesson);
		await db.delete(moduleAssignment);
		await db.delete(teachingClass);
		await db.delete(lessonSpecPoint);
		await db.delete(lesson);
		await db.delete(module);
		await db.delete(specPoint);
		await db.delete(topic);
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
		testExamSpec = specs[0];

		// Create test topic
		const topics = await db
			.insert(topic)
			.values({
				examSpecId: testExamSpec.id,
				name: 'Forces',
				code: '4.1',
				sortOrder: 1
			})
			.returning();
		testTopic = topics[0];

		// Create test spec points
		const points1 = await db
			.insert(specPoint)
			.values({
				topicId: testTopic.id,
				reference: '4.1.1',
				content: 'Scalar and vector quantities',
				sortOrder: 1
			})
			.returning();
		testSpecPoint1 = points1[0];

		const points2 = await db
			.insert(specPoint)
			.values({
				topicId: testTopic.id,
				reference: '4.1.2',
				content: 'Contact and non-contact forces',
				sortOrder: 2
			})
			.returning();
		testSpecPoint2 = points2[0];

		// Create test module
		const modules = await db
			.insert(module)
			.values({
				name: 'Forces and Motion',
				description: 'Introduction to forces',
				targetSpecId: testExamSpec.id
			})
			.returning();
		testModule = modules[0];
	});

	describe('load function', () => {
		it('should return 404 for non-existent module', async () => {
			await expect(load({ params: { id: 'non-existent-id' } } as RequestEvent)).rejects.toThrow();
		});

		it('should load module with basic details', async () => {
			const result = await load({ params: { id: testModule.id } } as RequestEvent);

			expect(result.module.id).toBe(testModule.id);
			expect(result.module.name).toBe('Forces and Motion');
			expect(result.module.description).toBe('Introduction to forces');
			expect(result.module.targetSpec).toBeDefined();
			expect(result.module.targetSpec.name).toBe('AQA GCSE Physics (8463)');
		});

		it('should load module with no lessons', async () => {
			const result = await load({ params: { id: testModule.id } } as RequestEvent);

			expect(result.lessons).toEqual([]);
		});

		it('should load module with lessons in order', async () => {
			await db.insert(lesson).values({
				moduleId: testModule.id,
				title: 'Lesson 1',
				content: '# Lesson 1 content',
				duration: 1,
				order: 1
			});

			await db.insert(lesson).values({
				moduleId: testModule.id,
				title: 'Lesson 2',
				content: '# Lesson 2 content',
				duration: 2,
				order: 2
			});

			await db.insert(lesson).values({
				moduleId: testModule.id,
				title: 'Lesson 3',
				content: null,
				duration: 1,
				order: 3
			});

			const result = await load({ params: { id: testModule.id } } as RequestEvent);

			expect(result.lessons).toHaveLength(3);
			expect(result.lessons[0].title).toBe('Lesson 1');
			expect(result.lessons[0].order).toBe(1);
			expect(result.lessons[0].duration).toBe(1);
			expect(result.lessons[1].title).toBe('Lesson 2');
			expect(result.lessons[1].duration).toBe(2);
			expect(result.lessons[2].title).toBe('Lesson 3');
			expect(result.lessons[2].content).toBeNull();
		});

		it('should load lessons with linked spec points', async () => {
			const lessons = await db
				.insert(lesson)
				.values({
					moduleId: testModule.id,
					title: 'Scalar and Vector quantities',
					order: 1
				})
				.returning();
			const testLesson = lessons[0];

			await db.insert(lessonSpecPoint).values({
				lessonId: testLesson.id,
				specPointId: testSpecPoint1.id
			});

			await db.insert(lessonSpecPoint).values({
				lessonId: testLesson.id,
				specPointId: testSpecPoint2.id
			});

			const result = await load({ params: { id: testModule.id } } as RequestEvent);

			expect(result.lessons).toHaveLength(1);
			expect(result.lessons[0].specPoints).toHaveLength(2);
			expect(result.lessons[0].specPoints[0].reference).toBe('4.1.1');
			expect(result.lessons[0].specPoints[1].reference).toBe('4.1.2');
		});

		it('should return all exam specs for the form', async () => {
			await db.insert(examSpec).values({
				board: 'OCR',
				level: 'A-Level',
				name: 'OCR A-Level Physics A (H556)',
				specCode: 'H556',
				specYear: '2015'
			});

			const result = await load({ params: { id: testModule.id } } as RequestEvent);

			expect(result.examSpecs).toHaveLength(2);
		});

		it('should return all spec points for the module target spec', async () => {
			const result = await load({ params: { id: testModule.id } } as RequestEvent);

			expect(result.specPoints).toHaveLength(2);
			expect(result.specPoints[0].reference).toBe('4.1.1');
			expect(result.specPoints[1].reference).toBe('4.1.2');
		});

		it('should return empty spec points if module has no target spec', async () => {
			const modules = await db
				.insert(module)
				.values({
					name: 'Generic Module',
					targetSpecId: null
				})
				.returning();

			const result = await load({ params: { id: modules[0].id } } as RequestEvent);

			expect(result.specPoints).toEqual([]);
		});
	});

	describe('updateModule action', () => {
		it('should update module name', async () => {
			const formData = new FormData();
			formData.append('name', 'Updated Forces and Motion');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.updateModule({
				request: mockRequest,
				params: { id: testModule.id }
			} as RequestEvent);

			expect(result?.success).toBe(true);

			const modules = await db.select().from(module).where(eq(module.id, testModule.id));
			expect(modules[0].name).toBe('Updated Forces and Motion');
		});

		it('should update module description', async () => {
			const formData = new FormData();
			formData.append('name', 'Forces and Motion');
			formData.append('description', 'Updated description');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.updateModule({
				request: mockRequest,
				params: { id: testModule.id }
			} as RequestEvent);

			expect(result?.success).toBe(true);

			const modules = await db.select().from(module).where(eq(module.id, testModule.id));
			expect(modules[0].description).toBe('Updated description');
		});

		it('should update module target spec', async () => {
			const newSpec = await db
				.insert(examSpec)
				.values({
					board: 'OCR',
					level: 'GCSE',
					name: 'OCR Gateway GCSE Physics',
					specCode: 'J249'
				})
				.returning();

			const formData = new FormData();
			formData.append('name', 'Forces and Motion');
			formData.append('targetSpecId', newSpec[0].id);

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.updateModule({
				request: mockRequest,
				params: { id: testModule.id }
			} as RequestEvent);

			expect(result?.success).toBe(true);

			const modules = await db.select().from(module).where(eq(module.id, testModule.id));
			expect(modules[0].targetSpecId).toBe(newSpec[0].id);
		});

		it('should validate name is required', async () => {
			const formData = new FormData();
			formData.append('name', '');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.updateModule({
				request: mockRequest,
				params: { id: testModule.id }
			} as RequestEvent);

			expect(result?.error).toBe('Module name is required');
		});
	});

	describe('addLesson action', () => {
		it('should add new lesson to module', async () => {
			const formData = new FormData();
			formData.append('title', 'New Lesson');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.addLesson({
				request: mockRequest,
				params: { id: testModule.id }
			} as RequestEvent);

			expect(result?.success).toBe(true);

			const lessons = await db.select().from(lesson).where(eq(lesson.moduleId, testModule.id));
			expect(lessons).toHaveLength(1);
			expect(lessons[0].title).toBe('New Lesson');
			expect(lessons[0].order).toBe(1);
		});

		it('should add lesson with all fields', async () => {
			const formData = new FormData();
			formData.append('title', 'Forces Introduction');
			formData.append('content', '# Forces\nIntroduction to forces');
			formData.append('duration', '2');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.addLesson({
				request: mockRequest,
				params: { id: testModule.id }
			} as RequestEvent);

			expect(result?.success).toBe(true);

			const lessons = await db.select().from(lesson).where(eq(lesson.moduleId, testModule.id));
			expect(lessons).toHaveLength(1);
			expect(lessons[0].title).toBe('Forces Introduction');
			expect(lessons[0].content).toBe('# Forces\nIntroduction to forces');
			expect(lessons[0].duration).toBe(2);
		});

		it('should set order as next available', async () => {
			await db.insert(lesson).values({
				moduleId: testModule.id,
				title: 'Existing Lesson 1',
				order: 1
			});

			await db.insert(lesson).values({
				moduleId: testModule.id,
				title: 'Existing Lesson 2',
				order: 2
			});

			const formData = new FormData();
			formData.append('title', 'New Lesson 3');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.addLesson({
				request: mockRequest,
				params: { id: testModule.id }
			} as RequestEvent);

			expect(result?.success).toBe(true);

			const lessons = await db
				.select()
				.from(lesson)
				.where(eq(lesson.moduleId, testModule.id))
				.orderBy(asc(lesson.order));

			expect(lessons).toHaveLength(3);
			expect(lessons[2].title).toBe('New Lesson 3');
			expect(lessons[2].order).toBe(3);
		});

		it('should validate title is required', async () => {
			const formData = new FormData();
			formData.append('title', '');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.addLesson({
				request: mockRequest,
				params: { id: testModule.id }
			} as RequestEvent);

			expect(result?.error).toBe('Lesson title is required');
		});
	});

	describe('updateLesson action', () => {
		let testLesson: { id: string };

		beforeEach(async () => {
			const lessons = await db
				.insert(lesson)
				.values({
					moduleId: testModule.id,
					title: 'Original Title',
					content: 'Original content',
					duration: 1,
					order: 1
				})
				.returning();
			testLesson = lessons[0];
		});

		it('should update lesson title', async () => {
			const formData = new FormData();
			formData.append('lessonId', testLesson.id);
			formData.append('title', 'Updated Title');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.updateLesson({
				request: mockRequest,
				params: { id: testModule.id }
			} as RequestEvent);

			expect(result?.success).toBe(true);

			const lessons = await db.select().from(lesson).where(eq(lesson.id, testLesson.id));
			expect(lessons[0].title).toBe('Updated Title');
		});

		it('should update lesson content', async () => {
			const formData = new FormData();
			formData.append('lessonId', testLesson.id);
			formData.append('title', 'Original Title');
			formData.append('content', '# Updated Content\nNew markdown content');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.updateLesson({
				request: mockRequest,
				params: { id: testModule.id }
			} as RequestEvent);

			expect(result?.success).toBe(true);

			const lessons = await db.select().from(lesson).where(eq(lesson.id, testLesson.id));
			expect(lessons[0].content).toBe('# Updated Content\nNew markdown content');
		});

		it('should update lesson duration', async () => {
			const formData = new FormData();
			formData.append('lessonId', testLesson.id);
			formData.append('title', 'Original Title');
			formData.append('duration', '2');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.updateLesson({
				request: mockRequest,
				params: { id: testModule.id }
			} as RequestEvent);

			expect(result?.success).toBe(true);

			const lessons = await db.select().from(lesson).where(eq(lesson.id, testLesson.id));
			expect(lessons[0].duration).toBe(2);
		});

		it('should validate title is required', async () => {
			const formData = new FormData();
			formData.append('lessonId', testLesson.id);
			formData.append('title', '');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.updateLesson({
				request: mockRequest,
				params: { id: testModule.id }
			} as RequestEvent);

			expect(result?.error).toBe('Lesson title is required');
		});
	});

	describe('deleteLesson action', () => {
		it('should delete lesson and reorder remaining lessons', async () => {
			await db.insert(lesson).values({
				moduleId: testModule.id,
				title: 'Lesson 1',
				order: 1
			});

			const lesson2 = await db
				.insert(lesson)
				.values({
					moduleId: testModule.id,
					title: 'Lesson 2',
					order: 2
				})
				.returning();

			await db.insert(lesson).values({
				moduleId: testModule.id,
				title: 'Lesson 3',
				order: 3
			});

			const formData = new FormData();
			formData.append('lessonId', lesson2[0].id);

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.deleteLesson({
				request: mockRequest,
				params: { id: testModule.id }
			} as RequestEvent);

			expect(result?.success).toBe(true);

			const lessons = await db
				.select()
				.from(lesson)
				.where(eq(lesson.moduleId, testModule.id))
				.orderBy(asc(lesson.order));

			expect(lessons).toHaveLength(2);
			expect(lessons[0].title).toBe('Lesson 1');
			expect(lessons[0].order).toBe(1);
			expect(lessons[1].title).toBe('Lesson 3');
			expect(lessons[1].order).toBe(2);
		});

		it('should cascade delete lesson spec point links', async () => {
			const lessons = await db
				.insert(lesson)
				.values({
					moduleId: testModule.id,
					title: 'Test Lesson',
					order: 1
				})
				.returning();

			await db.insert(lessonSpecPoint).values({
				lessonId: lessons[0].id,
				specPointId: testSpecPoint1.id
			});

			const formData = new FormData();
			formData.append('lessonId', lessons[0].id);

			const mockRequest = {
				formData: async () => formData
			} as Request;

			await actions.deleteLesson({
				request: mockRequest,
				params: { id: testModule.id }
			} as RequestEvent);

			const links = await db
				.select()
				.from(lessonSpecPoint)
				.where(eq(lessonSpecPoint.lessonId, lessons[0].id));

			expect(links).toHaveLength(0);
		});
	});

	describe('reorderLessons action', () => {
		let lesson1Id: string;
		let lesson2Id: string;
		let lesson3Id: string;

		beforeEach(async () => {
			const l1 = await db
				.insert(lesson)
				.values({
					moduleId: testModule.id,
					title: 'Lesson 1',
					order: 1
				})
				.returning();
			lesson1Id = l1[0].id;

			const l2 = await db
				.insert(lesson)
				.values({
					moduleId: testModule.id,
					title: 'Lesson 2',
					order: 2
				})
				.returning();
			lesson2Id = l2[0].id;

			const l3 = await db
				.insert(lesson)
				.values({
					moduleId: testModule.id,
					title: 'Lesson 3',
					order: 3
				})
				.returning();
			lesson3Id = l3[0].id;
		});

		it('should reorder lessons by provided order', async () => {
			const formData = new FormData();
			formData.append('lessonIds', JSON.stringify([lesson3Id, lesson1Id, lesson2Id]));

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.reorderLessons({
				request: mockRequest,
				params: { id: testModule.id }
			} as RequestEvent);

			expect(result?.success).toBe(true);

			const lessons = await db
				.select()
				.from(lesson)
				.where(eq(lesson.moduleId, testModule.id))
				.orderBy(asc(lesson.order));

			expect(lessons[0].id).toBe(lesson3Id);
			expect(lessons[0].order).toBe(1);
			expect(lessons[1].id).toBe(lesson1Id);
			expect(lessons[1].order).toBe(2);
			expect(lessons[2].id).toBe(lesson2Id);
			expect(lessons[2].order).toBe(3);
		});

		it('should validate all lesson IDs belong to module', async () => {
			const otherModule = await db
				.insert(module)
				.values({
					name: 'Other Module'
				})
				.returning();

			const otherLesson = await db
				.insert(lesson)
				.values({
					moduleId: otherModule[0].id,
					title: 'Other Lesson',
					order: 1
				})
				.returning();

			const formData = new FormData();
			formData.append('lessonIds', JSON.stringify([lesson1Id, otherLesson[0].id]));

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.reorderLessons({
				request: mockRequest,
				params: { id: testModule.id }
			} as RequestEvent);

			expect(result?.error).toBe('Invalid lesson IDs');
		});
	});

	describe('linkSpecPoint action', () => {
		let testLesson: { id: string };

		beforeEach(async () => {
			const lessons = await db
				.insert(lesson)
				.values({
					moduleId: testModule.id,
					title: 'Test Lesson',
					order: 1
				})
				.returning();
			testLesson = lessons[0];
		});

		it('should link spec point to lesson', async () => {
			const formData = new FormData();
			formData.append('lessonId', testLesson.id);
			formData.append('specPointId', testSpecPoint1.id);

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.linkSpecPoint({
				request: mockRequest,
				params: { id: testModule.id }
			} as RequestEvent);

			expect(result?.success).toBe(true);

			const links = await db
				.select()
				.from(lessonSpecPoint)
				.where(eq(lessonSpecPoint.lessonId, testLesson.id));

			expect(links).toHaveLength(1);
			expect(links[0].specPointId).toBe(testSpecPoint1.id);
		});

		it('should not create duplicate links', async () => {
			await db.insert(lessonSpecPoint).values({
				lessonId: testLesson.id,
				specPointId: testSpecPoint1.id
			});

			const formData = new FormData();
			formData.append('lessonId', testLesson.id);
			formData.append('specPointId', testSpecPoint1.id);

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.linkSpecPoint({
				request: mockRequest,
				params: { id: testModule.id }
			} as RequestEvent);

			expect(result?.success).toBe(true);

			const links = await db
				.select()
				.from(lessonSpecPoint)
				.where(eq(lessonSpecPoint.lessonId, testLesson.id));

			expect(links).toHaveLength(1);
		});
	});

	describe('unlinkSpecPoint action', () => {
		let testLesson: { id: string };

		beforeEach(async () => {
			const lessons = await db
				.insert(lesson)
				.values({
					moduleId: testModule.id,
					title: 'Test Lesson',
					order: 1
				})
				.returning();
			testLesson = lessons[0];

			await db.insert(lessonSpecPoint).values({
				lessonId: testLesson.id,
				specPointId: testSpecPoint1.id
			});

			await db.insert(lessonSpecPoint).values({
				lessonId: testLesson.id,
				specPointId: testSpecPoint2.id
			});
		});

		it('should unlink spec point from lesson', async () => {
			const formData = new FormData();
			formData.append('lessonId', testLesson.id);
			formData.append('specPointId', testSpecPoint1.id);

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.unlinkSpecPoint({
				request: mockRequest,
				params: { id: testModule.id }
			} as RequestEvent);

			expect(result?.success).toBe(true);

			const links = await db
				.select()
				.from(lessonSpecPoint)
				.where(eq(lessonSpecPoint.lessonId, testLesson.id));

			expect(links).toHaveLength(1);
			expect(links[0].specPointId).toBe(testSpecPoint2.id);
		});
	});
});
