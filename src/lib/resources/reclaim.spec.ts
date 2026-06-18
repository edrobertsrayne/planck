import { describe, it, expect } from 'vitest';
import { pathnamesToReclaim } from './reclaim';

describe('pathnamesToReclaim', () => {
	it('returns candidates that are no longer referenced', () => {
		expect(pathnamesToReclaim(['a', 'b', 'c'], ['b'])).toEqual(['a', 'c']);
	});

	it('de-duplicates candidates', () => {
		expect(pathnamesToReclaim(['a', 'a', 'b'], [])).toEqual(['a', 'b']);
	});

	it('returns nothing when every candidate is still referenced', () => {
		expect(pathnamesToReclaim(['a', 'b'], ['a', 'b'])).toEqual([]);
	});

	it('returns nothing for empty candidates', () => {
		expect(pathnamesToReclaim([], ['a'])).toEqual([]);
	});
});
