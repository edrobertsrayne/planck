import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getCurrentAcademicYear } from './academicYear';

describe('getCurrentAcademicYear', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('returns current year to next year when date is in or after September', () => {
		// September 1st, 2025 - start of new academic year
		vi.setSystemTime(new Date('2025-09-01'));
		expect(getCurrentAcademicYear()).toBe('2025-26');

		// December 2025 - middle of academic year
		vi.setSystemTime(new Date('2025-12-15'));
		expect(getCurrentAcademicYear()).toBe('2025-26');
	});

	it('returns previous year to current year when date is before September', () => {
		// January 2026 - still in 2025-26 academic year
		vi.setSystemTime(new Date('2026-01-15'));
		expect(getCurrentAcademicYear()).toBe('2025-26');

		// August 31st, 2026 - last day before new academic year
		vi.setSystemTime(new Date('2026-08-31'));
		expect(getCurrentAcademicYear()).toBe('2025-26');
	});

	it('formats year correctly as YYYY-YY', () => {
		// Test that the second year is formatted as 2 digits
		vi.setSystemTime(new Date('2024-09-01'));
		expect(getCurrentAcademicYear()).toBe('2024-25');

		vi.setSystemTime(new Date('2029-09-01'));
		expect(getCurrentAcademicYear()).toBe('2029-30');
	});

	it('handles year transition correctly', () => {
		// August 2024 - in 2023-24 academic year
		vi.setSystemTime(new Date('2024-08-31'));
		expect(getCurrentAcademicYear()).toBe('2023-24');

		// September 2024 - new academic year starts
		vi.setSystemTime(new Date('2024-09-01'));
		expect(getCurrentAcademicYear()).toBe('2024-25');
	});
});
