/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck - Test file with mock types for SvelteKit server functions
import { describe, it, expect, beforeEach } from 'vitest';
import { load, actions } from './+page.server.js';
import { db } from '$lib/server/db';
import { teachingClass, course } from '$lib/server/db/schema';
import type { RequestEvent } from '@sveltejs/kit';

describe('Classes List Page Server', () => {
	let testCourse: { id: string };

	beforeEach(async () => {
		// Clean up test data before each test
		await db.delete(teachingClass);
		await db.delete(course);

		// Create a test course for optional foreign key references
		const courses = await db.insert(course).values({ name: 'AQA GCSE Physics' }).returning();
		testCourse = courses[0];
	});

	describe('load function', () => {
		it('should return empty array when no classes exist', async () => {
			const result = await load({} as RequestEvent);

			expect(result.classes).toEqual([]);
		});

		it('should return all classes with course information', async () => {
			// Insert test classes
			await db.insert(teachingClass).values({
				name: '11X/Ph1',
				yearGroup: 11,
				courseId: testCourse.id,
				academicYear: '2024-25'
			});

			await db.insert(teachingClass).values({
				name: 'Year 12 Physics',
				yearGroup: 12,
				courseId: testCourse.id,
				academicYear: '2024-25',
				studentCount: 24,
				room: 'Lab 3'
			});

			const result = await load({} as RequestEvent);

			expect(result.classes).toHaveLength(2);
			expect(result.classes[0].name).toBe('11X/Ph1');
			expect(result.classes[0].yearGroup).toBe(11);
			expect(result.classes[0].academicYear).toBe('2024-25');
			expect(result.classes[0].course).toBeDefined();
			expect(result.classes[0].course.name).toBe('AQA GCSE Physics');

			expect(result.classes[1].name).toBe('Year 12 Physics');
			expect(result.classes[1].studentCount).toBe(24);
			expect(result.classes[1].room).toBe('Lab 3');
		});

		it('should order classes by name', async () => {
			await db.insert(teachingClass).values({
				name: 'Year 13 Physics',
				yearGroup: 13,
				courseId: testCourse.id,
				academicYear: '2024-25'
			});

			await db.insert(teachingClass).values({
				name: '11X/Ph1',
				yearGroup: 11,
				courseId: testCourse.id,
				academicYear: '2024-25'
			});

			await db.insert(teachingClass).values({
				name: 'Year 12 Physics',
				yearGroup: 12,
				courseId: testCourse.id,
				academicYear: '2024-25'
			});

			const result = await load({} as RequestEvent);

			expect(result.classes).toHaveLength(3);
			expect(result.classes[0].name).toBe('11X/Ph1');
			expect(result.classes[1].name).toBe('Year 12 Physics');
			expect(result.classes[2].name).toBe('Year 13 Physics');
		});
	});

	describe('create action', () => {
		it('should create new class with required fields', async () => {
			const formData = new FormData();
			formData.append('name', '11X/Ph1');
			formData.append('yearGroup', '11');
			formData.append('courseId', testCourse.id);
			formData.append('academicYear', '2024-25');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.create({ request: mockRequest } as RequestEvent);

			expect(result?.success).toBe(true);

			const classes = await db.select().from(teachingClass);
			expect(classes).toHaveLength(1);
			expect(classes[0].name).toBe('11X/Ph1');
			expect(classes[0].yearGroup).toBe(11);
			expect(classes[0].courseId).toBe(testCourse.id);
			expect(classes[0].academicYear).toBe('2024-25');
		});

		it('should create new class with optional fields', async () => {
			const formData = new FormData();
			formData.append('name', 'Year 12 Physics');
			formData.append('yearGroup', '12');
			formData.append('courseId', testCourse.id);
			formData.append('academicYear', '2024-25');
			formData.append('studentCount', '24');
			formData.append('room', 'Lab 3');
			formData.append('notes', 'Advanced group');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.create({ request: mockRequest } as RequestEvent);

			expect(result?.success).toBe(true);

			const classes = await db.select().from(teachingClass);
			expect(classes).toHaveLength(1);
			expect(classes[0].name).toBe('Year 12 Physics');
			expect(classes[0].studentCount).toBe(24);
			expect(classes[0].room).toBe('Lab 3');
			expect(classes[0].notes).toBe('Advanced group');
		});

		it('should create class without a course (courseId is optional)', async () => {
			const formData = new FormData();
			formData.append('name', 'Test Class');
			formData.append('yearGroup', '11');
			formData.append('courseId', '');
			formData.append('academicYear', '2024-25');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.create({ request: mockRequest } as RequestEvent);

			expect(result?.success).toBe(true);

			const classes = await db.select().from(teachingClass);
			expect(classes).toHaveLength(1);
			expect(classes[0].courseId).toBeNull();
		});

		it('should validate name is required', async () => {
			const formData = new FormData();
			formData.append('name', '');
			formData.append('yearGroup', '11');
			formData.append('courseId', testCourse.id);
			formData.append('academicYear', '2024-25');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.create({ request: mockRequest } as RequestEvent);

			expect(result?.error).toBe('Class name is required');
			const classes = await db.select().from(teachingClass);
			expect(classes).toHaveLength(0);
		});

		it('should validate year group is between 7 and 13', async () => {
			const formData = new FormData();
			formData.append('name', 'Test Class');
			formData.append('yearGroup', '6');
			formData.append('courseId', testCourse.id);
			formData.append('academicYear', '2024-25');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.create({ request: mockRequest } as RequestEvent);

			expect(result?.error).toBe('Year group must be between 7 and 13');
			const classes = await db.select().from(teachingClass);
			expect(classes).toHaveLength(0);
		});

		it('should validate year group upper bound', async () => {
			const formData = new FormData();
			formData.append('name', 'Test Class');
			formData.append('yearGroup', '14');
			formData.append('courseId', testCourse.id);
			formData.append('academicYear', '2024-25');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.create({ request: mockRequest } as RequestEvent);

			expect(result?.error).toBe('Year group must be between 7 and 13');
			const classes = await db.select().from(teachingClass);
			expect(classes).toHaveLength(0);
		});

		it('should validate academic year is required', async () => {
			const formData = new FormData();
			formData.append('name', 'Test Class');
			formData.append('yearGroup', '11');
			formData.append('courseId', testCourse.id);
			formData.append('academicYear', '');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.create({ request: mockRequest } as RequestEvent);

			expect(result?.error).toBe('Academic year is required');
			const classes = await db.select().from(teachingClass);
			expect(classes).toHaveLength(0);
		});

		it('should handle optional student count', async () => {
			const formData = new FormData();
			formData.append('name', 'Test Class');
			formData.append('yearGroup', '11');
			formData.append('courseId', testCourse.id);
			formData.append('academicYear', '2024-25');
			formData.append('studentCount', '');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.create({ request: mockRequest } as RequestEvent);

			expect(result?.success).toBe(true);

			const classes = await db.select().from(teachingClass);
			expect(classes).toHaveLength(1);
			expect(classes[0].studentCount).toBeNull();
		});

		it('should validate student count is a positive number when provided', async () => {
			const formData = new FormData();
			formData.append('name', 'Test Class');
			formData.append('yearGroup', '11');
			formData.append('courseId', testCourse.id);
			formData.append('academicYear', '2024-25');
			formData.append('studentCount', '-5');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.create({ request: mockRequest } as RequestEvent);

			expect(result?.error).toBe('Student count must be a positive number');
			const classes = await db.select().from(teachingClass);
			expect(classes).toHaveLength(0);
		});
	});
});
