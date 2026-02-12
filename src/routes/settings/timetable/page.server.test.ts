/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck - Test file with mock types for SvelteKit server functions
import { describe, it, expect, beforeEach } from 'vitest';
import { load, actions } from './+page.server.js';
import { db } from '$lib/server/db';
import { timetableConfig } from '$lib/server/db/schema';
import type { RequestEvent } from '@sveltejs/kit';

describe('Timetable Configuration Page Server', () => {
	beforeEach(async () => {
		// Clean up test data before each test
		await db.delete(timetableConfig);
	});

	describe('load function', () => {
		it('should return empty config when no config exists', async () => {
			const result = await load({} as RequestEvent);

			expect(result).toEqual({ config: null });
		});

		it('should return existing config for the current academic year', async () => {
			// Insert test config
			await db
				.insert(timetableConfig)
				.values({
					academicYear: '2024-25',
					weeks: 2,
					periodsPerDay: 8,
					daysPerWeek: 5
				})
				.returning();

			const result = await load({} as RequestEvent);

			expect(result.config).toBeDefined();
			expect(result.config?.academicYear).toBe('2024-25');
			expect(result.config?.weeks).toBe(2);
			expect(result.config?.periodsPerDay).toBe(8);
			expect(result.config?.daysPerWeek).toBe(5);
		});

		it('should return the most recent config when multiple exist', async () => {
			// Insert multiple configs
			await db.insert(timetableConfig).values({
				academicYear: '2023-24',
				weeks: 1,
				periodsPerDay: 6,
				daysPerWeek: 5
			});

			await db.insert(timetableConfig).values({
				academicYear: '2024-25',
				weeks: 2,
				periodsPerDay: 7,
				daysPerWeek: 5
			});

			const result = await load({} as RequestEvent);

			expect(result.config?.academicYear).toBe('2024-25');
		});
	});

	describe('save action', () => {
		it('should create new config when none exists', async () => {
			const formData = new FormData();
			formData.append('academicYear', '2024-25');
			formData.append('weeks', '1');
			formData.append('periodsPerDay', '6');
			formData.append('daysPerWeek', '5');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			await actions.save({ request: mockRequest } as RequestEvent);

			const configs = await db.select().from(timetableConfig);
			expect(configs).toHaveLength(1);
			expect(configs[0].academicYear).toBe('2024-25');
			expect(configs[0].weeks).toBe(1);
			expect(configs[0].periodsPerDay).toBe(6);
			expect(configs[0].daysPerWeek).toBe(5);
		});

		it('should update existing config for the same academic year', async () => {
			// Insert initial config
			await db.insert(timetableConfig).values({
				academicYear: '2024-25',
				weeks: 1,
				periodsPerDay: 6,
				daysPerWeek: 5
			});

			const formData = new FormData();
			formData.append('academicYear', '2024-25');
			formData.append('weeks', '2');
			formData.append('periodsPerDay', '8');
			formData.append('daysPerWeek', '6');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			await actions.save({ request: mockRequest } as RequestEvent);

			const configs = await db.select().from(timetableConfig);
			expect(configs).toHaveLength(1);
			expect(configs[0].academicYear).toBe('2024-25');
			expect(configs[0].weeks).toBe(2);
			expect(configs[0].periodsPerDay).toBe(8);
			expect(configs[0].daysPerWeek).toBe(6);
		});

		it('should validate weeks is 1 or 2', async () => {
			const formData = new FormData();
			formData.append('academicYear', '2024-25');
			formData.append('weeks', '3');
			formData.append('periodsPerDay', '6');
			formData.append('daysPerWeek', '5');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.save({ request: mockRequest } as RequestEvent);

			expect(result?.error).toBe('Weeks must be 1 or 2');
			const configs = await db.select().from(timetableConfig);
			expect(configs).toHaveLength(0);
		});

		it('should validate periodsPerDay is between 1 and 10', async () => {
			const formData = new FormData();
			formData.append('academicYear', '2024-25');
			formData.append('weeks', '1');
			formData.append('periodsPerDay', '11');
			formData.append('daysPerWeek', '5');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.save({ request: mockRequest } as RequestEvent);

			expect(result?.error).toBe('Periods per day must be between 1 and 10');
			const configs = await db.select().from(timetableConfig);
			expect(configs).toHaveLength(0);
		});

		it('should validate daysPerWeek is between 1 and 7', async () => {
			const formData = new FormData();
			formData.append('academicYear', '2024-25');
			formData.append('weeks', '1');
			formData.append('periodsPerDay', '6');
			formData.append('daysPerWeek', '8');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.save({ request: mockRequest } as RequestEvent);

			expect(result?.error).toBe('Days per week must be between 1 and 7');
			const configs = await db.select().from(timetableConfig);
			expect(configs).toHaveLength(0);
		});

		it('should validate academicYear is provided', async () => {
			const formData = new FormData();
			formData.append('academicYear', '');
			formData.append('weeks', '1');
			formData.append('periodsPerDay', '6');
			formData.append('daysPerWeek', '5');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.save({ request: mockRequest } as RequestEvent);

			expect(result?.error).toBe('Academic year is required');
			const configs = await db.select().from(timetableConfig);
			expect(configs).toHaveLength(0);
		});

		it('should return success message on successful save', async () => {
			const formData = new FormData();
			formData.append('academicYear', '2024-25');
			formData.append('weeks', '1');
			formData.append('periodsPerDay', '6');
			formData.append('daysPerWeek', '5');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.save({ request: mockRequest } as RequestEvent);

			expect(result?.success).toBe(true);
		});
	});
});
