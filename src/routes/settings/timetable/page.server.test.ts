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

			expect(result.globalConfig).toBeNull();
			expect(result.config).toBeNull();
			expect(result.currentAcademicYear).toBe('2025-26'); // Current year as of test date
		});

		it('should return existing config for the current academic year', async () => {
			// Insert GLOBAL config
			await db.insert(timetableConfig).values({
				academicYear: 'GLOBAL',
				weeks: 2,
				periodsPerDay: 6,
				daysPerWeek: 5
			});

			// Insert year-specific config for CURRENT year (2025-26)
			await db
				.insert(timetableConfig)
				.values({
					academicYear: '2025-26',
					weeks: 1, // Not used
					periodsPerDay: 8,
					daysPerWeek: 5
				})
				.returning();

			const result = await load({} as RequestEvent);

			expect(result.globalConfig).toBeDefined();
			expect(result.globalConfig?.weeks).toBe(2);
			expect(result.config).toBeDefined();
			expect(result.config?.academicYear).toBe('2025-26');
			expect(result.config?.periodsPerDay).toBe(8);
			expect(result.config?.daysPerWeek).toBe(5);
			expect(result.currentAcademicYear).toBe('2025-26');
		});

		it('should only return current year config, not previous years', async () => {
			// Insert GLOBAL config
			await db.insert(timetableConfig).values({
				academicYear: 'GLOBAL',
				weeks: 2,
				periodsPerDay: 6,
				daysPerWeek: 5
			});

			// Insert multiple year-specific configs for PREVIOUS years
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

			// Should NOT return previous years' configs
			expect(result.config).toBeNull();
			expect(result.currentAcademicYear).toBe('2025-26');
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
			// Expect 2 records: GLOBAL and year-specific
			expect(configs).toHaveLength(2);

			const globalConfig = configs.find((c) => c.academicYear === 'GLOBAL');
			const yearConfig = configs.find((c) => c.academicYear === '2024-25');

			expect(globalConfig).toBeDefined();
			expect(globalConfig?.weeks).toBe(1);

			expect(yearConfig).toBeDefined();
			expect(yearConfig?.academicYear).toBe('2024-25');
			expect(yearConfig?.periodsPerDay).toBe(6);
			expect(yearConfig?.daysPerWeek).toBe(5);
		});

		it('should update existing config for the same academic year', async () => {
			// Insert initial configs
			await db.insert(timetableConfig).values({
				academicYear: 'GLOBAL',
				weeks: 1,
				periodsPerDay: 6,
				daysPerWeek: 5
			});

			await db.insert(timetableConfig).values({
				academicYear: '2024-25',
				weeks: 1,
				periodsPerDay: 6,
				daysPerWeek: 5
			});

			const formData = new FormData();
			formData.append('academicYear', '2024-25');
			formData.append('weeks', '2');
			formData.append('periodsPerDay', '7');
			formData.append('daysPerWeek', '5');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			await actions.save({ request: mockRequest } as RequestEvent);

			const configs = await db.select().from(timetableConfig);
			// Still 2 records: GLOBAL and year-specific
			expect(configs).toHaveLength(2);

			const globalConfig = configs.find((c) => c.academicYear === 'GLOBAL');
			const yearConfig = configs.find((c) => c.academicYear === '2024-25');

			expect(globalConfig?.weeks).toBe(2);
			expect(yearConfig?.periodsPerDay).toBe(7);
		});

		it('should return error for missing academic year', async () => {
			const formData = new FormData();
			formData.append('weeks', '1');
			formData.append('periodsPerDay', '6');
			formData.append('daysPerWeek', '5');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.save({ request: mockRequest } as RequestEvent);

			expect(result).toHaveProperty('error');
		});

		it('should return error for invalid weeks value', async () => {
			const formData = new FormData();
			formData.append('academicYear', '2024-25');
			formData.append('weeks', '3');
			formData.append('periodsPerDay', '6');
			formData.append('daysPerWeek', '5');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.save({ request: mockRequest } as RequestEvent);

			expect(result).toHaveProperty('error');
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

			expect(result).toEqual({ success: true });
		});
	});
});
