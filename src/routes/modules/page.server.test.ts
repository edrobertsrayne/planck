/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck - Test file with mock types for SvelteKit server functions
import { describe, it, expect, beforeEach } from 'vitest';
import { load, actions } from './+page.server.js';
import { db } from '$lib/server/db';
import { module, examSpec, lesson, moduleAssignment, teachingClass } from '$lib/server/db/schema';
import type { RequestEvent } from '@sveltejs/kit';

describe('Module Library Page Server', () => {
	let testExamSpec1: { id: string };
	let testClass: { id: string };

	beforeEach(async () => {
		// Clean up test data before each test
		await db.delete(moduleAssignment);
		await db.delete(lesson);
		await db.delete(module);
		await db.delete(teachingClass);
		await db.delete(examSpec);

		// Create test exam specs for foreign key references
		const specs1 = await db
			.insert(examSpec)
			.values({
				board: 'AQA',
				level: 'GCSE',
				name: 'AQA GCSE Physics (8463)',
				specCode: '8463',
				specYear: '2018'
			})
			.returning();
		testExamSpec1 = specs1[0];

		// Create second exam spec for filtering tests
		await db.insert(examSpec).values({
			board: 'OCR',
			level: 'A-Level',
			name: 'OCR A-Level Physics A (H556)',
			specCode: 'H556',
			specYear: '2015'
		});

		// Create a test class for assignment counting
		const classes = await db
			.insert(teachingClass)
			.values({
				name: '11X/Ph1',
				yearGroup: 11,
				examSpecId: testExamSpec1.id,
				academicYear: '2024-25'
			})
			.returning();
		testClass = classes[0];
	});

	describe('load function', () => {
		it('should return empty array when no modules exist', async () => {
			const result = await load({} as RequestEvent);

			expect(result.modules).toEqual([]);
		});

		it('should return all modules with exam spec information', async () => {
			// Insert test modules
			await db.insert(module).values({
				name: 'Forces and Motion',
				description: 'Introduction to forces, motion, and energy',
				targetSpecId: testExamSpec1.id
			});

			await db.insert(module).values({
				name: 'Electricity',
				description: 'Current, voltage, and resistance',
				targetSpecId: testExamSpec1.id
			});

			const result = await load({} as RequestEvent);

			expect(result.modules).toHaveLength(2);
			expect(result.modules[0].name).toBe('Electricity');
			expect(result.modules[0].description).toBe('Current, voltage, and resistance');
			expect(result.modules[0].targetSpec).toBeDefined();
			expect(result.modules[0].targetSpec.name).toBe('AQA GCSE Physics (8463)');

			expect(result.modules[1].name).toBe('Forces and Motion');
		});

		it('should order modules by name alphabetically', async () => {
			await db.insert(module).values({ name: 'Waves' });
			await db.insert(module).values({ name: 'Atoms' });
			await db.insert(module).values({ name: 'Forces' });

			const result = await load({} as RequestEvent);

			expect(result.modules).toHaveLength(3);
			expect(result.modules[0].name).toBe('Atoms');
			expect(result.modules[1].name).toBe('Forces');
			expect(result.modules[2].name).toBe('Waves');
		});

		it('should count lessons in each module', async () => {
			// Create a module with lessons
			const modules = await db.insert(module).values({ name: 'Forces and Motion' }).returning();
			const mod = modules[0];

			await db.insert(lesson).values({
				moduleId: mod.id,
				title: 'Lesson 1',
				order: 1
			});

			await db.insert(lesson).values({
				moduleId: mod.id,
				title: 'Lesson 2',
				order: 2
			});

			await db.insert(lesson).values({
				moduleId: mod.id,
				title: 'Lesson 3',
				order: 3
			});

			const result = await load({} as RequestEvent);

			expect(result.modules).toHaveLength(1);
			expect(result.modules[0].lessonCount).toBe(3);
		});

		it('should count module assignments to classes', async () => {
			// Create a module
			const modules = await db.insert(module).values({ name: 'Forces and Motion' }).returning();
			const mod = modules[0];

			// Create assignment
			await db.insert(moduleAssignment).values({
				classId: testClass.id,
				moduleId: mod.id,
				startDate: new Date('2024-09-01')
			});

			const result = await load({} as RequestEvent);

			expect(result.modules).toHaveLength(1);
			expect(result.modules[0].assignmentCount).toBe(1);
		});

		it('should handle modules with no lessons or assignments', async () => {
			await db.insert(module).values({ name: 'Empty Module' });

			const result = await load({} as RequestEvent);

			expect(result.modules).toHaveLength(1);
			expect(result.modules[0].lessonCount).toBe(0);
			expect(result.modules[0].assignmentCount).toBe(0);
		});

		it('should return all exam specs for filtering', async () => {
			const result = await load({} as RequestEvent);

			expect(result.examSpecs).toHaveLength(2);
			expect(result.examSpecs[0].level).toBe('A-Level');
			expect(result.examSpecs[0].board).toBe('OCR');
			expect(result.examSpecs[1].level).toBe('GCSE');
			expect(result.examSpecs[1].board).toBe('AQA');
		});

		it('should handle null target spec ID', async () => {
			await db.insert(module).values({
				name: 'Generic Module',
				targetSpecId: null
			});

			const result = await load({} as RequestEvent);

			expect(result.modules).toHaveLength(1);
			expect(result.modules[0].targetSpec).toBeNull();
		});
	});

	describe('create action', () => {
		it('should create new module with only required fields', async () => {
			const formData = new FormData();
			formData.append('name', 'Forces and Motion');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.create({ request: mockRequest } as RequestEvent);

			expect(result?.success).toBe(true);

			const modules = await db.select().from(module);
			expect(modules).toHaveLength(1);
			expect(modules[0].name).toBe('Forces and Motion');
			expect(modules[0].description).toBeNull();
			expect(modules[0].targetSpecId).toBeNull();
		});

		it('should create new module with all fields', async () => {
			const formData = new FormData();
			formData.append('name', 'Forces and Motion');
			formData.append('description', 'Introduction to forces');
			formData.append('targetSpecId', testExamSpec1.id);

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.create({ request: mockRequest } as RequestEvent);

			expect(result?.success).toBe(true);

			const modules = await db.select().from(module);
			expect(modules).toHaveLength(1);
			expect(modules[0].name).toBe('Forces and Motion');
			expect(modules[0].description).toBe('Introduction to forces');
			expect(modules[0].targetSpecId).toBe(testExamSpec1.id);
		});

		it('should validate name is required', async () => {
			const formData = new FormData();
			formData.append('name', '');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.create({ request: mockRequest } as RequestEvent);

			expect(result?.error).toBe('Module name is required');
			const modules = await db.select().from(module);
			expect(modules).toHaveLength(0);
		});

		it('should trim whitespace from name', async () => {
			const formData = new FormData();
			formData.append('name', '  Forces and Motion  ');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.create({ request: mockRequest } as RequestEvent);

			expect(result?.success).toBe(true);

			const modules = await db.select().from(module);
			expect(modules[0].name).toBe('Forces and Motion');
		});

		it('should handle empty description as null', async () => {
			const formData = new FormData();
			formData.append('name', 'Test Module');
			formData.append('description', '   ');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.create({ request: mockRequest } as RequestEvent);

			expect(result?.success).toBe(true);

			const modules = await db.select().from(module);
			expect(modules[0].description).toBeNull();
		});

		it('should handle empty targetSpecId as null', async () => {
			const formData = new FormData();
			formData.append('name', 'Test Module');
			formData.append('targetSpecId', '');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.create({ request: mockRequest } as RequestEvent);

			expect(result?.success).toBe(true);

			const modules = await db.select().from(module);
			expect(modules[0].targetSpecId).toBeNull();
		});
	});
});
