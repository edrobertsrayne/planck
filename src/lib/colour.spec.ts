import { describe, it, expect } from 'vitest';
import { withAlpha } from './colour';

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
