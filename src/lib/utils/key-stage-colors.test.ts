import { describe, it, expect } from 'vitest';
import { getKeyStageColor, getKeyStageLabel } from './key-stage-colors';

describe('getKeyStageColor', () => {
	it('returns KS3 color for years 7-9', () => {
		expect(getKeyStageColor(7)).toBe('var(--ks3-color)');
		expect(getKeyStageColor(8)).toBe('var(--ks3-color)');
		expect(getKeyStageColor(9)).toBe('var(--ks3-color)');
	});

	it('returns GCSE color for years 10-11', () => {
		expect(getKeyStageColor(10)).toBe('var(--gcse-color)');
		expect(getKeyStageColor(11)).toBe('var(--gcse-color)');
	});

	it('returns A-Level color for years 12-13', () => {
		expect(getKeyStageColor(12)).toBe('var(--alevel-color)');
		expect(getKeyStageColor(13)).toBe('var(--alevel-color)');
	});

	it('returns muted color for out-of-range years', () => {
		expect(getKeyStageColor(6)).toBe('var(--text-muted)');
		expect(getKeyStageColor(14)).toBe('var(--text-muted)');
		expect(getKeyStageColor(0)).toBe('var(--text-muted)');
		expect(getKeyStageColor(-1)).toBe('var(--text-muted)');
		expect(getKeyStageColor(100)).toBe('var(--text-muted)');
	});
});

describe('getKeyStageLabel', () => {
	it('returns "KS3" for years 7-9', () => {
		expect(getKeyStageLabel(7)).toBe('KS3');
		expect(getKeyStageLabel(8)).toBe('KS3');
		expect(getKeyStageLabel(9)).toBe('KS3');
	});

	it('returns "GCSE" for years 10-11', () => {
		expect(getKeyStageLabel(10)).toBe('GCSE');
		expect(getKeyStageLabel(11)).toBe('GCSE');
	});

	it('returns "A-Level" for years 12-13', () => {
		expect(getKeyStageLabel(12)).toBe('A-Level');
		expect(getKeyStageLabel(13)).toBe('A-Level');
	});

	it('returns empty string for out-of-range years', () => {
		expect(getKeyStageLabel(6)).toBe('');
		expect(getKeyStageLabel(14)).toBe('');
		expect(getKeyStageLabel(0)).toBe('');
		expect(getKeyStageLabel(-1)).toBe('');
		expect(getKeyStageLabel(100)).toBe('');
	});
});
