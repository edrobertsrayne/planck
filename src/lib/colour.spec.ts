import { describe, it, expect } from 'vitest';
import { withAlpha, darken, subjectTint } from './colour';

describe('withAlpha', () => {
	it('appends a two-digit alpha to a 6-digit hex', () => {
		expect(withAlpha('#ff0000', 0.5)).toBe('#ff000080');
	});

	it('clamps alpha to the 0–1 range', () => {
		expect(withAlpha('#abcdef', 2)).toBe('#abcdefff');
		expect(withAlpha('#abcdef', -1)).toBe('#abcdef00');
	});

	it('returns the input unchanged when it is not a 6-digit hex', () => {
		expect(withAlpha('red', 0.5)).toBe('red');
		expect(withAlpha('#fff', 0.5)).toBe('#fff');
	});
});

describe('darken', () => {
	it('mixes a hex toward ink, returning a 6-digit hex', () => {
		const out = darken('#5ba06e', 0.35);
		expect(out).toMatch(/^#[0-9a-f]{6}$/);
		expect(out).not.toBe('#5ba06e');
	});
	it('returns non-hex input unchanged', () => {
		expect(darken('rebeccapurple', 0.3)).toBe('rebeccapurple');
	});
});

describe('subjectTint', () => {
	it('derives dot/bar/bg/soft/text from one hex', () => {
		const t = subjectTint('#5ba06e');
		expect(t.dot).toBe('#5ba06e');
		expect(t.bar).toBe('#5ba06e');
		expect(t.bg).toBe('#5ba06e21');
		expect(t.soft).toBe('#5ba06e1a');
		expect(t.text).toMatch(/^#[0-9a-f]{6}$/);
		expect(t.text).not.toBe('#5ba06e');
	});
});
