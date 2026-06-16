import { describe, it, expect } from 'vitest';
import { pickFreeSlots } from './free-slots';

const stream = [
	{ date: '2026-06-16', period: 2, room: 'R1' },
	{ date: '2026-06-17', period: 1, room: 'R2' },
	{ date: '2026-06-18', period: 5, room: 'R3' },
	{ date: '2026-06-22', period: 1, room: 'R4' }
];

describe('pickFreeSlots', () => {
	it('returns the first n slots not in occupied', () => {
		const occupied = new Set(['2026-06-16|2']);
		expect(pickFreeSlots(stream, occupied, 2)).toEqual([
			{ date: '2026-06-17', period: 1, room: 'R2' },
			{ date: '2026-06-18', period: 5, room: 'R3' }
		]);
	});
	it('returns fewer than n when the stream is short', () => {
		expect(pickFreeSlots(stream, new Set(), 10)).toHaveLength(4);
	});
});
