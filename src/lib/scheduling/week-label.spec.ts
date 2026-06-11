import { describe, it, expect } from 'vitest';
import { groupByDate } from './week-label';

describe('groupByDate', () => {
	it('groups items by their date in order', () => {
		const items = [
			{ date: '2026-09-14', period: 2, label: 'b' },
			{ date: '2026-09-14', period: 1, label: 'a' },
			{ date: '2026-09-15', period: 1, label: 'c' }
		];
		const groups = groupByDate(items);
		expect(groups.map((g) => g.date)).toEqual(['2026-09-14', '2026-09-15']);
		expect(groups[0].items.map((i) => i.period)).toEqual([1, 2]); // sorted by period
	});
});
