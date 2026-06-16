import type { IsoDate } from './dates';

export interface SlotOccurrence {
	date: IsoDate;
	period: number;
	room: string;
}

/** First `n` stream slots whose `${date}|${period}` key is not in `occupied`. */
export function pickFreeSlots(
	stream: SlotOccurrence[],
	occupied: Set<string>,
	n: number
): SlotOccurrence[] {
	const out: SlotOccurrence[] = [];
	for (const s of stream) {
		if (occupied.has(`${s.date}|${s.period}`)) continue;
		out.push(s);
		if (out.length >= n) break;
	}
	return out;
}
