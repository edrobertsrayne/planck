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
