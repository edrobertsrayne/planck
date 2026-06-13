import type { IsoDate } from './dates';
import type { PeriodOccurrence } from './types';

/** A class's sequence row, as far as allocation cares: identity + current date. */
export interface SeqItem {
	id: number;
	date: IsoDate | null;
}

/** New slot assignment for a flow row. date/period null => overflow. */
export interface SlotAllocation {
	id: number;
	date: IsoDate | null;
	period: number | null;
	room: string;
}

/**
 * Map the class's ordered sequence onto its future slot stream.
 *
 * - Frozen rows (a non-null date strictly before `today`) are already taught;
 *   they are excluded from the result and must be left untouched by the caller.
 * - Remaining ("flow") rows, in sequence order, take the next available slot.
 * - Flow rows past the end of the stream overflow to null date/period.
 *
 * `futureStream` MUST already be filtered to slots on/after `today` and sorted
 * chronologically.
 */
export function allocateSequence(
	items: SeqItem[],
	futureStream: PeriodOccurrence[],
	today: IsoDate
): SlotAllocation[] {
	const flow = items.filter((it) => it.date === null || it.date >= today);
	return flow.map((it, i) => {
		const slot = futureStream[i];
		return slot
			? { id: it.id, date: slot.date, period: slot.period, room: slot.room }
			: { id: it.id, date: null, period: null, room: '' };
	});
}
