export type IsoDate = string; // 'YYYY-MM-DD'
export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7; // ISO: 1=Mon..7=Sun

function toUtc(d: IsoDate): Date {
	return new Date(`${d}T00:00:00Z`);
}

function fromUtc(d: Date): IsoDate {
	return d.toISOString().slice(0, 10);
}

export function addDays(d: IsoDate, n: number): IsoDate {
	const date = toUtc(d);
	date.setUTCDate(date.getUTCDate() + n);
	return fromUtc(date);
}

export function dayOfWeekIso(d: IsoDate): DayOfWeek {
	const js = toUtc(d).getUTCDay(); // 0=Sun..6=Sat
	return (js === 0 ? 7 : js) as DayOfWeek;
}

export function mondayOf(d: IsoDate): IsoDate {
	return addDays(d, -(dayOfWeekIso(d) - 1));
}

export function eachDate(start: IsoDate, end: IsoDate): IsoDate[] {
	const out: IsoDate[] = [];
	for (let cur = start; cur <= end; cur = addDays(cur, 1)) out.push(cur);
	return out;
}

export function isWeekday(d: IsoDate): boolean {
	return dayOfWeekIso(d) <= 5;
}

function pad(n: number): string {
	return String(n).padStart(2, '0');
}

/** Days in `month` (1–12) for calendar `year`, leap-year aware. */
function daysInMonthOfYear(year: number, month: number): number {
	// Date.UTC's month arg is 0-indexed, so `month` (1-indexed) is next month;
	// day 0 of next month is the last day of the desired month.
	return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Max days in `month` (1–12), Feb counted as 29 (year-agnostic; for validation). */
export function daysInMonth(month: number): number {
	return [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

/** Build an IsoDate, clamping `day` to the month's real length that year. */
function makeDate(year: number, month: number, day: number): IsoDate {
	return `${year}-${pad(month)}-${pad(Math.min(day, daysInMonthOfYear(year, month)))}`;
}

/**
 * The retention cutoff: the start of the PREVIOUS academic year. Scheduled
 * lessons dated strictly before this are purged (keep current + previous year).
 * `startMonth`/`startDay` define the academic-year boundary (e.g. 9/1 for UK schools).
 */
export function academicYearCutoff(today: IsoDate, startMonth: number, startDay: number): IsoDate {
	const year = Number(today.slice(0, 4));
	const thisYearStart = makeDate(year, startMonth, startDay);
	// The most recent year-start on/before today is the current academic year.
	const currentStartYear = today >= thisYearStart ? year : year - 1;
	return makeDate(currentStartYear - 1, startMonth, startDay);
}
