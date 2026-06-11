import { eq, and, desc } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { scheduledLesson, klass, course } from '$lib/server/db/schema';
import { getConfig, getBlocks, getClosures, getSlots } from './timetable';
import { getModule, listLessons } from './courses';
import { getClass } from './classes';
import { classPeriodStream } from '$lib/scheduling/periods';
import { planModuleAssignment } from '$lib/scheduling/scheduler';
import { addDays } from '$lib/scheduling/dates';
import type { SlotData } from '$lib/scheduling/types';

export function todayIso(): string {
	return new Date().toISOString().slice(0, 10);
}

export interface AssignResult {
	scheduled: number;
	unscheduled: number;
	firstDate: string | null;
	lastDate: string | null;
}

export async function assignModule(
	userId: string,
	moduleId: number,
	classId: number,
	today: string = todayIso()
): Promise<AssignResult> {
	const mod = await getModule(userId, moduleId);
	const cls = await getClass(userId, classId);
	if (!mod || !cls) throw new Error('Module or class not found');
	if (mod.courseId !== cls.courseId) throw new Error('Class does not study this course');

	const [config, blocks, closures, slots, lessons] = await Promise.all([
		getConfig(userId),
		getBlocks(userId),
		getClosures(userId),
		getSlots(userId),
		listLessons(userId, moduleId)
	]);
	if (lessons.length === 0) return { scheduled: 0, unscheduled: 0, firstDate: null, lastDate: null };

	const stream = classPeriodStream(
		config,
		blocks.map((b) => ({ startDate: b.startDate, endDate: b.endDate })),
		closures.map((c) => c.date),
		slots as SlotData[],
		classId
	);

	const [last] = await db
		.select({ date: scheduledLesson.date, period: scheduledLesson.period })
		.from(scheduledLesson)
		.where(and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.classId, classId)))
		.orderBy(desc(scheduledLesson.date), desc(scheduledLesson.period))
		.limit(1);

	const plan = planModuleAssignment(stream, lessons, {
		notBefore: addDays(today, 1),
		lastScheduled: last ?? undefined
	});

	if (plan.placements.length > 0) {
		await db.insert(scheduledLesson).values(
			plan.placements.map((p) => ({
				userId,
				classId,
				lessonId: p.lessonId,
				moduleId,
				date: p.date,
				period: p.period,
				title: p.title,
				room: p.room
			}))
		);
	}

	return {
		scheduled: plan.placements.length,
		unscheduled: plan.unscheduledCount,
		firstDate: plan.placements[0]?.date ?? null,
		lastDate: plan.placements.at(-1)?.date ?? null
	};
}

export function unscheduleModule(userId: string, moduleId: number, classId: number) {
	return db
		.delete(scheduledLesson)
		.where(
			and(
				eq(scheduledLesson.userId, userId),
				eq(scheduledLesson.moduleId, moduleId),
				eq(scheduledLesson.classId, classId)
			)
		);
}

export function deleteScheduledLesson(userId: string, id: number) {
	return db
		.delete(scheduledLesson)
		.where(and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.id, id)));
}

export async function moveScheduledLesson(
	userId: string,
	id: number,
	date: string,
	period: number,
	room: string
) {
	await db
		.update(scheduledLesson)
		.set({ date, period, room })
		.where(and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.id, id)));
}

/** Scheduled lessons joined with class + course. Callers filter by date range. */
export function listUpcoming(userId: string) {
	return db
		.select({
			id: scheduledLesson.id,
			date: scheduledLesson.date,
			period: scheduledLesson.period,
			title: scheduledLesson.title,
			room: scheduledLesson.room,
			moduleId: scheduledLesson.moduleId,
			classId: scheduledLesson.classId,
			className: klass.name,
			courseName: course.name,
			colour: course.colour
		})
		.from(scheduledLesson)
		.innerJoin(klass, eq(scheduledLesson.classId, klass.id))
		.innerJoin(course, eq(klass.courseId, course.id))
		.where(eq(scheduledLesson.userId, userId))
		.orderBy(scheduledLesson.date, scheduledLesson.period);
}
