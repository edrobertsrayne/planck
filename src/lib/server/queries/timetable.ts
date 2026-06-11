import { eq, and } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	timetableConfig,
	teachingBlock,
	closureDay,
	timetableSlot
} from '$lib/server/db/schema';
import type { DayOfWeek } from '$lib/scheduling/dates';
import type { WeekLetter } from '$lib/scheduling/types';

const DEFAULT_CONFIG = {
	cycleWeeks: 2 as 1 | 2,
	teachingDays: [1, 2, 3, 4, 5] as DayOfWeek[],
	periodsPerDay: 5,
	anchorLetter: 'A' as WeekLetter
};

export async function getConfig(userId: string) {
	const [row] = await db
		.select()
		.from(timetableConfig)
		.where(eq(timetableConfig.userId, userId));
	if (!row) return { ...DEFAULT_CONFIG };
	return {
		cycleWeeks: row.cycleWeeks as 1 | 2,
		teachingDays: row.teachingDays as DayOfWeek[],
		periodsPerDay: row.periodsPerDay,
		anchorLetter: row.anchorLetter as WeekLetter
	};
}

export async function upsertConfig(
	userId: string,
	data: {
		cycleWeeks: number;
		teachingDays: number[];
		periodsPerDay: number;
		anchorLetter: string;
	}
) {
	await db
		.insert(timetableConfig)
		.values({ userId, ...data })
		.onConflictDoUpdate({ target: timetableConfig.userId, set: data });
}

export function getBlocks(userId: string) {
	return db
		.select()
		.from(teachingBlock)
		.where(eq(teachingBlock.userId, userId))
		.orderBy(teachingBlock.startDate);
}

export function addBlock(userId: string, name: string, startDate: string, endDate: string) {
	return db.insert(teachingBlock).values({ userId, name, startDate, endDate });
}

export function deleteBlock(userId: string, id: number) {
	return db.delete(teachingBlock).where(and(eq(teachingBlock.userId, userId), eq(teachingBlock.id, id)));
}

export function getClosures(userId: string) {
	return db
		.select()
		.from(closureDay)
		.where(eq(closureDay.userId, userId))
		.orderBy(closureDay.date);
}

export function addClosure(userId: string, date: string) {
	return db.insert(closureDay).values({ userId, date });
}

export function deleteClosure(userId: string, id: number) {
	return db.delete(closureDay).where(and(eq(closureDay.userId, userId), eq(closureDay.id, id)));
}

export function getSlots(userId: string) {
	return db.select().from(timetableSlot).where(eq(timetableSlot.userId, userId));
}

export async function setSlot(
	userId: string,
	data: { weekLetter: string; dayOfWeek: number; period: number; classId: number; room: string }
) {
	await db
		.insert(timetableSlot)
		.values({ userId, ...data })
		.onConflictDoUpdate({
			target: [timetableSlot.userId, timetableSlot.weekLetter, timetableSlot.dayOfWeek, timetableSlot.period],
			set: { classId: data.classId, room: data.room }
		});
}

export function clearSlot(userId: string, weekLetter: string, dayOfWeek: number, period: number) {
	return db
		.delete(timetableSlot)
		.where(
			and(
				eq(timetableSlot.userId, userId),
				eq(timetableSlot.weekLetter, weekLetter),
				eq(timetableSlot.dayOfWeek, dayOfWeek),
				eq(timetableSlot.period, period)
			)
		);
}
