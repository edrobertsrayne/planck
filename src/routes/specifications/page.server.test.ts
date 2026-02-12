/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck - Test file with mock types for SvelteKit server functions
import { describe, it, expect, beforeEach } from 'vitest';
import { load } from './+page.server.js';
import { db } from '$lib/server/db';
import { examSpec } from '$lib/server/db/schema';
import type { RequestEvent } from '@sveltejs/kit';

describe('Specifications List Page Server', () => {
	beforeEach(async () => {
		// Clean up test data before each test
		await db.delete(examSpec);
	});

	describe('load function', () => {
		it('should return empty array when no specifications exist', async () => {
			const result = await load({} as RequestEvent);

			expect(result.specs).toEqual([]);
		});

		it('should return all exam specifications', async () => {
			// Insert test specifications
			await db.insert(examSpec).values({
				board: 'AQA',
				level: 'GCSE',
				name: 'AQA GCSE Physics (8463)',
				specCode: '8463',
				specYear: '2018'
			});

			await db.insert(examSpec).values({
				board: 'OCR',
				level: 'A-Level',
				name: 'OCR A-Level Physics A (H556)',
				specCode: 'H556',
				specYear: '2015'
			});

			const result = await load({} as RequestEvent);

			expect(result.specs.length).toBeGreaterThanOrEqual(2);
			// Check our inserted specs are present
			expect(result.specs.some((s) => s.board === 'AQA' && s.level === 'GCSE')).toBe(true);
			expect(result.specs.some((s) => s.board === 'OCR' && s.level === 'A-Level')).toBe(true);
		});

		it('should order specifications by level then board', async () => {
			// Insert in random order
			await db.insert(examSpec).values({
				board: 'OCR',
				level: 'A-Level',
				name: 'OCR A-Level Physics A (H556)',
				specCode: 'H556',
				specYear: '2015'
			});

			await db.insert(examSpec).values({
				board: 'AQA',
				level: 'GCSE',
				name: 'AQA GCSE Physics (8463)',
				specCode: '8463',
				specYear: '2018'
			});

			await db.insert(examSpec).values({
				board: 'Edexcel',
				level: 'A-Level',
				name: 'Edexcel A-Level Physics',
				specCode: '9PH0',
				specYear: '2015'
			});

			const result = await load({} as RequestEvent);

			expect(result.specs).toHaveLength(3);
			// A-Level comes before GCSE alphabetically
			expect(result.specs[0].level).toBe('A-Level');
			expect(result.specs[1].level).toBe('A-Level');
			expect(result.specs[2].level).toBe('GCSE');
			// Within same level, ordered by board
			expect(result.specs[0].board).toBe('Edexcel');
			expect(result.specs[1].board).toBe('OCR');
			expect(result.specs[2].board).toBe('AQA');
		});

		it('should include all spec fields', async () => {
			await db.insert(examSpec).values({
				board: 'AQA',
				level: 'GCSE',
				name: 'AQA GCSE Physics (8463)',
				specCode: '8463',
				specYear: '2018'
			});

			const result = await load({} as RequestEvent);

			expect(result.specs[0]).toHaveProperty('id');
			expect(result.specs[0]).toHaveProperty('board', 'AQA');
			expect(result.specs[0]).toHaveProperty('level', 'GCSE');
			expect(result.specs[0]).toHaveProperty('name', 'AQA GCSE Physics (8463)');
			expect(result.specs[0]).toHaveProperty('specCode', '8463');
			expect(result.specs[0]).toHaveProperty('specYear', '2018');
		});
	});
});
