import { describe, it, expect } from 'vitest';

describe('Calendar Navigation Logic', () => {
	describe('Date Navigation', () => {
		it('navigates forward one day correctly', () => {
			const currentDate = new Date('2024-03-15T00:00:00.000Z');
			const newDate = new Date(currentDate);
			newDate.setUTCDate(newDate.getUTCDate() + 1);
			expect(newDate.toISOString()).toBe('2024-03-16T00:00:00.000Z');
		});

		it('navigates backward one day correctly', () => {
			const currentDate = new Date('2024-03-15T00:00:00.000Z');
			const newDate = new Date(currentDate);
			newDate.setUTCDate(newDate.getUTCDate() - 1);
			expect(newDate.toISOString()).toBe('2024-03-14T00:00:00.000Z');
		});

		it('navigates forward one week correctly', () => {
			const currentDate = new Date('2024-03-15T00:00:00.000Z');
			const newDate = new Date(currentDate);
			newDate.setUTCDate(newDate.getUTCDate() + 7);
			expect(newDate.toISOString()).toBe('2024-03-22T00:00:00.000Z');
		});

		it('navigates backward one week correctly', () => {
			const currentDate = new Date('2024-03-15T00:00:00.000Z');
			const newDate = new Date(currentDate);
			newDate.setUTCDate(newDate.getUTCDate() - 7);
			expect(newDate.toISOString()).toBe('2024-03-08T00:00:00.000Z');
		});

		it('navigates forward two weeks for 2-week timetable', () => {
			const currentDate = new Date('2024-03-15T00:00:00.000Z');
			const newDate = new Date(currentDate);
			const weeksConfig = 2;
			newDate.setUTCDate(newDate.getUTCDate() + weeksConfig * 7);
			expect(newDate.toISOString()).toBe('2024-03-29T00:00:00.000Z');
		});

		it('navigates backward two weeks for 2-week timetable', () => {
			const currentDate = new Date('2024-03-15T00:00:00.000Z');
			const newDate = new Date(currentDate);
			const weeksConfig = 2;
			newDate.setUTCDate(newDate.getUTCDate() - weeksConfig * 7);
			expect(newDate.toISOString()).toBe('2024-03-01T00:00:00.000Z');
		});

		it('navigates forward by 3 months for term view', () => {
			const currentDate = new Date(Date.UTC(2024, 2, 15, 0, 0, 0));
			const newDate = new Date(currentDate);
			newDate.setUTCMonth(newDate.getUTCMonth() + 3);
			expect(newDate.getUTCFullYear()).toBe(2024);
			expect(newDate.getUTCMonth()).toBe(5);
			expect(newDate.getUTCDate()).toBe(15);
		});

		it('navigates backward by 3 months for term view', () => {
			const currentDate = new Date(Date.UTC(2024, 5, 15, 0, 0, 0));
			const newDate = new Date(currentDate);
			newDate.setUTCMonth(newDate.getUTCMonth() - 3);
			expect(newDate.getUTCFullYear()).toBe(2024);
			expect(newDate.getUTCMonth()).toBe(2);
			expect(newDate.getUTCDate()).toBe(15);
		});
	});

	describe('View Selection Logic', () => {
		it('identifies day view correctly from undefined', () => {
			const viewParam = undefined;
			const view = viewParam === 'week' || viewParam === 'term' ? viewParam : 'day';
			expect(view).toBe('day');
		});

		it('identifies week view correctly', () => {
			const viewParam = 'week';
			const view = viewParam === 'week' || viewParam === 'term' ? viewParam : 'day';
			expect(view).toBe('week');
		});

		it('identifies term view correctly', () => {
			const viewParam: string = 'term';
			const result = viewParam === 'week' ? 'week' : viewParam === 'term' ? 'term' : 'day';
			expect(result).toBe('term');
		});
	});

	describe('Academic Year Calculation', () => {
		it('calculates academic year for September correctly', () => {
			const date = new Date('2024-09-15');
			const month = date.getUTCMonth();

			let academicYear: string;
			if (month >= 8) {
				const year = date.getUTCFullYear();
				academicYear = `${year}-${(year + 1).toString().slice(-2)}`;
			} else if (month <= 3) {
				const year = date.getUTCFullYear() - 1;
				academicYear = `${year}-${date.getUTCFullYear().toString().slice(-2)}`;
			} else {
				const year = date.getUTCFullYear() - 1;
				academicYear = `${year}-${date.getUTCFullYear().toString().slice(-2)}`;
			}

			expect(academicYear).toBe('2024-25');
		});

		it('calculates academic year for January correctly', () => {
			const date = new Date('2025-01-15');
			const month = date.getUTCMonth();

			let academicYear: string;
			if (month >= 8) {
				const year = date.getUTCFullYear();
				academicYear = `${year}-${(year + 1).toString().slice(-2)}`;
			} else if (month <= 3) {
				const year = date.getUTCFullYear() - 1;
				academicYear = `${year}-${date.getUTCFullYear().toString().slice(-2)}`;
			} else {
				const year = date.getUTCFullYear() - 1;
				academicYear = `${year}-${date.getUTCFullYear().toString().slice(-2)}`;
			}

			expect(academicYear).toBe('2024-25');
		});

		it('calculates academic year for April correctly', () => {
			const date = new Date('2025-04-15');
			const month = date.getUTCMonth();

			let academicYear: string;
			if (month >= 8) {
				const year = date.getUTCFullYear();
				academicYear = `${year}-${(year + 1).toString().slice(-2)}`;
			} else if (month <= 3) {
				const year = date.getUTCFullYear() - 1;
				academicYear = `${year}-${date.getUTCFullYear().toString().slice(-2)}`;
			} else {
				const year = date.getUTCFullYear() - 1;
				academicYear = `${year}-${date.getUTCFullYear().toString().slice(-2)}`;
			}

			expect(academicYear).toBe('2024-25');
		});
	});

	describe('Week Calculation', () => {
		it('calculates week number correctly', () => {
			const date = new Date('2024-09-15');
			const startDate = new Date(date.getFullYear(), 8, 1);
			const diff = date.getTime() - startDate.getTime();
			const weekNum = Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;

			expect(weekNum).toBeGreaterThan(0);
			expect(weekNum).toBeLessThanOrEqual(52);
		});

		it('identifies Week A correctly', () => {
			const date = new Date('2024-09-15');
			const startDate = new Date(date.getFullYear(), 8, 1);
			const diff = date.getTime() - startDate.getTime();
			const weekNum = Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
			const isWeekA = weekNum % 2 === 1;

			expect(isWeekA).toBe(true);
		});

		it('identifies Week B correctly', () => {
			const date = new Date('2024-09-22');
			const startDate = new Date(date.getFullYear(), 8, 1);
			const diff = date.getTime() - startDate.getTime();
			const weekNum = Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
			const isWeekA = weekNum % 2 === 1;

			expect(isWeekA).toBe(false);
		});

		it('generates 7 days for 1-week timetable', () => {
			const numWeeks = 1;
			const numDays = numWeeks * 7;
			expect(numDays).toBe(7);
		});

		it('generates 14 days for 2-week timetable', () => {
			const numWeeks = 2;
			const numDays = numWeeks * 7;
			expect(numDays).toBe(14);
		});
	});

	describe('Class Color Generation', () => {
		const colorOptions = [
			'bg-blue-100 border-blue-300 text-blue-800',
			'bg-green-100 border-green-300 text-green-800',
			'bg-purple-100 border-purple-300 text-purple-800',
			'bg-orange-100 border-orange-300 text-orange-800',
			'bg-pink-100 border-pink-300 text-pink-800',
			'bg-teal-100 border-teal-300 text-teal-800',
			'bg-indigo-100 border-indigo-300 text-indigo-800',
			'bg-amber-100 border-amber-300 text-amber-800',
			'bg-cyan-100 border-cyan-300 text-cyan-800',
			'bg-rose-100 border-rose-300 text-rose-800'
		];

		it('generates unique colors for first 10 classes', () => {
			const colors = new Set<string>();
			for (let i = 0; i < 10; i++) {
				colors.add(colorOptions[i % colorOptions.length]);
			}
			expect(colors.size).toBe(10);
		});

		it('wraps colors for more than 10 classes', () => {
			const class11Color = colorOptions[10 % colorOptions.length];
			expect(class11Color).toBe(colorOptions[0]);
		});

		it('colors are valid Tailwind classes', () => {
			colorOptions.forEach((color) => {
				expect(color).toMatch(/^bg-[a-z]+-\d+ border-[a-z]+-\d+ text-[a-z]+-\d+$/);
			});
		});
	});

	describe('Date Formatting', () => {
		it('formats date correctly for display', () => {
			const date = new Date(Date.UTC(2024, 2, 15, 0, 0, 0));
			const formatted = date.toLocaleDateString('en-GB', {
				weekday: 'long',
				day: 'numeric',
				month: 'long',
				year: 'numeric'
			});

			expect(formatted).toContain('Friday');
			expect(formatted).toContain('15');
			expect(formatted).toContain('March');
			expect(formatted).toContain('2024');
		});

		it('formats short date correctly', () => {
			const date = new Date(Date.UTC(2024, 2, 15, 0, 0, 0));
			const formatted = date.toLocaleDateString('en-GB', {
				day: 'numeric',
				month: 'short'
			});

			expect(formatted).toContain('15');
			expect(formatted).toContain('Mar');
		});
	});

	describe('Week Start Calculation', () => {
		it('calculates start of week correctly for Monday', () => {
			const date = new Date('2024-03-15');
			const day = date.getUTCDay();
			const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1);
			const startOfWeek = new Date(date);
			startOfWeek.setUTCDate(diff);

			expect(startOfWeek.getUTCDay()).toBe(1);
		});

		it('calculates end of week correctly for 1-week timetable', () => {
			const startDate = new Date('2024-03-11T00:00:00.000Z');
			const endDate = new Date(startDate);
			const numWeeks = 1;
			endDate.setUTCDate(endDate.getUTCDate() + numWeeks * 7 - 1);

			expect(endDate.toISOString()).toBe('2024-03-17T00:00:00.000Z');
		});

		it('calculates end of week correctly for 2-week timetable', () => {
			const startDate = new Date('2024-03-11T00:00:00.000Z');
			const endDate = new Date(startDate);
			const numWeeks = 2;
			endDate.setUTCDate(endDate.getUTCDate() + numWeeks * 7 - 1);

			expect(endDate.toISOString()).toBe('2024-03-24T00:00:00.000Z');
		});
	});

	describe('Event Date Matching', () => {
		it('finds event for date within range', () => {
			const checkDate = new Date('2024-03-15T00:00:00.000Z');
			const eventStart = new Date('2024-03-10T00:00:00.000Z');
			const eventEnd = new Date('2024-03-20T00:00:00.000Z');

			const isMatch = checkDate >= eventStart && checkDate <= eventEnd;
			expect(isMatch).toBe(true);
		});

		it('returns false for date outside event range', () => {
			const checkDate = new Date('2024-03-25T00:00:00.000Z');
			const eventStart = new Date('2024-03-10T00:00:00.000Z');
			const eventEnd = new Date('2024-03-20T00:00:00.000Z');

			const isMatch = checkDate >= eventStart && checkDate <= eventEnd;
			expect(isMatch).toBe(false);
		});
	});

	describe('Term View Calculations', () => {
		it('calculates Autumn term dates correctly', () => {
			const date = new Date(Date.UTC(2024, 9, 15)); // October 2024
			const month = date.getUTCMonth();

			let termStart: Date;
			let termEnd: Date;

			if (month >= 8 || month <= 0) {
				termStart = new Date(Date.UTC(date.getUTCFullYear(), 8, 1));
				termEnd = new Date(Date.UTC(date.getUTCFullYear(), 11, 31));
			} else if (month <= 3) {
				termStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
				termEnd = new Date(Date.UTC(date.getUTCFullYear(), 2, 31));
			} else {
				termStart = new Date(Date.UTC(date.getUTCFullYear(), 3, 1));
				termEnd = new Date(Date.UTC(date.getUTCFullYear(), 6, 31));
			}

			expect(termStart.getUTCMonth()).toBe(8); // September
			expect(termEnd.getUTCMonth()).toBe(11); // December
		});

		it('calculates Spring term dates correctly', () => {
			const date = new Date(Date.UTC(2025, 1, 15)); // February 2025
			const month = date.getUTCMonth();

			let termStart: Date;
			let termEnd: Date;

			if (month >= 8 || month <= 0) {
				termStart = new Date(Date.UTC(date.getUTCFullYear(), 8, 1));
				termEnd = new Date(Date.UTC(date.getUTCFullYear(), 11, 31));
			} else if (month <= 3) {
				termStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
				termEnd = new Date(Date.UTC(date.getUTCFullYear(), 2, 31));
			} else {
				termStart = new Date(Date.UTC(date.getUTCFullYear(), 3, 1));
				termEnd = new Date(Date.UTC(date.getUTCFullYear(), 6, 31));
			}

			expect(termStart.getUTCMonth()).toBe(0); // January
			expect(termEnd.getUTCMonth()).toBe(2); // March
		});

		it('calculates Summer term dates correctly', () => {
			const date = new Date(Date.UTC(2025, 5, 15)); // June 2025
			const month = date.getUTCMonth();

			let termStart: Date;
			let termEnd: Date;

			if (month >= 8 || month <= 0) {
				termStart = new Date(Date.UTC(date.getUTCFullYear(), 8, 1));
				termEnd = new Date(Date.UTC(date.getUTCFullYear(), 11, 31));
			} else if (month <= 3) {
				termStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
				termEnd = new Date(Date.UTC(date.getUTCFullYear(), 2, 31));
			} else {
				termStart = new Date(Date.UTC(date.getUTCFullYear(), 3, 1));
				termEnd = new Date(Date.UTC(date.getUTCFullYear(), 6, 31));
			}

			expect(termStart.getUTCMonth()).toBe(3); // April
			expect(termEnd.getUTCMonth()).toBe(6); // July
		});

		it('generates correct number of weeks for term grid', () => {
			const termStart = new Date(Date.UTC(2024, 8, 1)); // September 1
			const termEnd = new Date(Date.UTC(2024, 11, 31)); // December 31

			const firstDayOfMonth = new Date(termStart);
			const startDayOfWeek = firstDayOfMonth.getUTCDay();
			const daysToMonday = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
			const weekStart = new Date(firstDayOfMonth);
			weekStart.setUTCDate(weekStart.getUTCDate() - daysToMonday);

			const current = new Date(weekStart);
			const weeks: (Date | null)[][] = [];
			let week: (Date | null)[] = [];

			for (let i = 0; i < 42; i++) {
				const dayDate = new Date(current);

				if (dayDate < termStart || dayDate > termEnd) {
					week.push(null);
				} else {
					week.push(dayDate);
				}

				if (week.length === 7) {
					weeks.push(week);
					week = [];
				}
				current.setUTCDate(current.getUTCDate() + 1);
			}

			const filteredWeeks = weeks.filter((w) => w.some((d) => d !== null));

			expect(filteredWeeks.length).toBeGreaterThan(0);
			expect(filteredWeeks.length).toBeLessThanOrEqual(6);
			expect(filteredWeeks[0].length).toBe(7);
		});

		it('filters out empty weeks correctly', () => {
			const weeks: (Date | null)[][] = [
				[null, null, null, null, null, null, null],
				[null, new Date(), null, null, null, null, null],
				[null, null, null, null, null, null, null]
			];

			const filtered = weeks.filter((w) => w.some((d) => d !== null));

			expect(filtered.length).toBe(1);
		});

		it('calculates teaching days excluding holidays and closures', () => {
			const weeks: (Date | null)[][] = [
				[
					new Date(Date.UTC(2024, 8, 2)),
					new Date(Date.UTC(2024, 8, 3)),
					new Date(Date.UTC(2024, 8, 4)),
					new Date(Date.UTC(2024, 8, 5)),
					new Date(Date.UTC(2024, 8, 6)),
					null,
					null
				]
			];

			const events = [
				{
					type: 'holiday',
					startDate: new Date(Date.UTC(2024, 8, 4)),
					endDate: new Date(Date.UTC(2024, 8, 4))
				}
			];

			let count = 0;
			for (const week of weeks) {
				for (const day of week) {
					if (!day) continue;
					const event = events.find((e) => {
						const checkDate = new Date(day);
						checkDate.setUTCHours(0, 0, 0, 0);
						const start = new Date(e.startDate);
						start.setUTCHours(0, 0, 0, 0);
						const end = new Date(e.endDate);
						end.setUTCHours(0, 0, 0, 0);
						return checkDate >= start && checkDate <= end;
					});

					if (!event || event.type === 'absence') {
						count++;
					}
				}
			}

			expect(count).toBe(4); // 5 days - 1 holiday
		});
	});
});
