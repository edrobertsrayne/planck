import { describe, it, expect } from 'vitest';
import { classPeriodStream } from './periods';
import type { TimetableConfigData, SlotData } from './types';

const config: TimetableConfigData = {
	cycleWeeks: 2,
	teachingDays: [1, 2, 3, 4, 5],
	periodsPerDay: 5,
	anchorLetter: 'A'
};

// Class 10 is taught Mon P1 in week A and Tue P3 in week B.
const slots: SlotData[] = [
	{ weekLetter: 'A', dayOfWeek: 1, period: 1, classId: 10, room: 'S1' },
	{ weekLetter: 'B', dayOfWeek: 2, period: 3, classId: 10, room: 'S2' },
	{ weekLetter: 'A', dayOfWeek: 1, period: 1, classId: 99, room: 'X9' } // other class
];

describe('classPeriodStream', () => {
	it('emits only the target class occurrences, ordered by date then period', () => {
		const stream = classPeriodStream(
			config,
			[{ startDate: '2026-09-14', endDate: '2026-09-25' }], // two weeks Mon..Fri
			[],
			slots,
			10
		);
		expect(stream).toEqual([
			{ date: '2026-09-14', period: 1, room: 'S1' }, // Mon week A
			{ date: '2026-09-22', period: 3, room: 'S2' } // Tue week B
		]);
	});

	it('skips closure days', () => {
		const stream = classPeriodStream(
			config,
			[{ startDate: '2026-09-14', endDate: '2026-09-25' }],
			['2026-09-14'], // close the only week-A Monday
			slots,
			10
		);
		expect(stream).toEqual([{ date: '2026-09-22', period: 3, room: 'S2' }]);
	});
});
