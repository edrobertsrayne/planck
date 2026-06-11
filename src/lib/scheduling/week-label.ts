import type { IsoDate } from './dates';

export function groupByDate<T extends { date: IsoDate; period: number }>(
	items: T[]
): { date: IsoDate; items: T[] }[] {
	const byDate = new Map<IsoDate, T[]>();
	for (const item of items) {
		const list = byDate.get(item.date) ?? [];
		list.push(item);
		byDate.set(item.date, list);
	}
	return [...byDate.keys()]
		.sort()
		.map((date) => ({ date, items: byDate.get(date)!.sort((a, b) => a.period - b.period) }));
}
