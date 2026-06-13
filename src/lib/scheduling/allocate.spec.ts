import { describe, it, expect } from 'vitest';
import { allocateSequence } from './allocate';
import type { PeriodOccurrence } from './types';

const stream: PeriodOccurrence[] = [
	{ date: '2026-09-14', period: 1, room: 'S1' },
	{ date: '2026-09-15', period: 2, room: 'S1' },
	{ date: '2026-09-16', period: 3, room: 'S2' }
];
const today = '2026-09-14';

describe('allocateSequence', () => {
	it('fills flow items chronologically onto the stream', () => {
		const out = allocateSequence(
			[
				{ id: 1, date: null },
				{ id: 2, date: null }
			],
			stream,
			today
		);
		expect(out).toEqual([
			{ id: 1, date: '2026-09-14', period: 1, room: 'S1' },
			{ id: 2, date: '2026-09-15', period: 2, room: 'S1' }
		]);
	});

	it('excludes frozen past items from the output (leaves them untouched)', () => {
		const out = allocateSequence(
			[
				{ id: 1, date: '2026-09-01' }, // frozen (before today)
				{ id: 2, date: null }
			],
			stream,
			today
		);
		expect(out.map((a) => a.id)).toEqual([2]);
		expect(out[0]).toEqual({ id: 2, date: '2026-09-14', period: 1, room: 'S1' });
	});

	it('overflows items beyond the stream to null date/period', () => {
		const out = allocateSequence(
			[
				{ id: 1, date: null },
				{ id: 2, date: null },
				{ id: 3, date: null },
				{ id: 4, date: null }
			],
			stream,
			today
		);
		expect(out[3]).toEqual({ id: 4, date: null, period: null, room: '' });
	});

	it('self-heals: a previously-overflowed item is allocated when the stream grows', () => {
		const items = [
			{ id: 1, date: null },
			{ id: 2, date: null },
			{ id: 3, date: null },
			{ id: 4, date: null }
		];
		const longer = [...stream, { date: '2026-09-17', period: 1, room: 'S1' }];
		const out = allocateSequence(items, longer, today);
		expect(out[3]).toEqual({ id: 4, date: '2026-09-17', period: 1, room: 'S1' });
	});

	it('reallocates a future (non-frozen) dated item rather than freezing it', () => {
		// date >= today is still "flow" and gets re-derived.
		const out = allocateSequence([{ id: 1, date: '2026-09-30' }], stream, today);
		expect(out[0]).toEqual({ id: 1, date: '2026-09-14', period: 1, room: 'S1' });
	});

	it('returns [] for an empty sequence', () => {
		expect(allocateSequence([], stream, today)).toEqual([]);
	});

	it('overflows every item when the stream is empty', () => {
		const out = allocateSequence(
			[
				{ id: 1, date: null },
				{ id: 2, date: null }
			],
			[],
			today
		);
		expect(out).toEqual([
			{ id: 1, date: null, period: null, room: '' },
			{ id: 2, date: null, period: null, room: '' }
		]);
	});
});
