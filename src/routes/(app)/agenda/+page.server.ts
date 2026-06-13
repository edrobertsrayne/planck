import { gte, and, eq } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { requireUserId } from '$lib/server/session';
import { db } from '$lib/server/db';
import { scheduledLesson, klass, course } from '$lib/server/db/schema';
import { todayIso, deleteFromSequence, moveScheduledLesson } from '$lib/server/queries/schedule';
import { getConfig, getBlocks, getClosures, getSlots } from '$lib/server/queries/timetable';
import { dayOfWeekIso } from '$lib/scheduling/dates';
import { listTeachingDays } from '$lib/scheduling/teaching-days';
import { resolveWeekLetters, weekLetterForDate } from '$lib/scheduling/week-letter';
import { groupByDate } from '$lib/scheduling/week-label';

export const load: PageServerLoad = async (event) => {
	const userId = requireUserId(event);
	const today = todayIso();

	const rows = await db
		.select({
			id: scheduledLesson.id,
			classId: scheduledLesson.classId,
			date: scheduledLesson.date,
			period: scheduledLesson.period,
			title: scheduledLesson.title,
			room: scheduledLesson.room,
			className: klass.name,
			courseName: course.name,
			colour: course.colour
		})
		.from(scheduledLesson)
		.innerJoin(klass, eq(scheduledLesson.classId, klass.id))
		.innerJoin(course, eq(klass.courseId, course.id))
		.where(and(eq(scheduledLesson.userId, userId), gte(scheduledLesson.date, today)))
		.orderBy(scheduledLesson.date, scheduledLesson.period);

	const [config, blocks, closures] = await Promise.all([
		getConfig(userId),
		getBlocks(userId),
		getClosures(userId)
	]);
	const teaching = listTeachingDays(
		blocks.map((b) => ({ startDate: b.startDate, endDate: b.endDate })),
		closures.map((c) => c.date),
		config.teachingDays
	);
	const weekMap = resolveWeekLetters(config.cycleWeeks, config.anchorLetter, teaching);

	// date/period are nullable in the schema (overflow rows), but the query's
	// `gte(date, today)` already excludes them; narrow so groupByDate is satisfied.
	const dated = rows.filter(
		(r): r is (typeof rows)[number] & { date: string; period: number } =>
			r.date !== null && r.period !== null
	);
	const groups = groupByDate(dated).map((g) => ({
		...g,
		weekLetter: weekLetterForDate(g.date, weekMap)
	}));
	return { groups };
};

export const actions: Actions = {
	deleteLesson: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await deleteFromSequence(userId, Number(form.get('id')));
	},

	moveLesson: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		const id = Number(form.get('id'));
		const date = String(form.get('date'));
		const period = Number(form.get('period'));

		// Look up the lesson's classId
		const [row] = await db
			.select({ classId: scheduledLesson.classId })
			.from(scheduledLesson)
			.where(and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.id, id)));
		if (!row) return fail(404, { moveError: 'Lesson not found' });

		const slots = await getSlots(userId);
		const dow = dayOfWeekIso(date);
		// Target must be a timetabled period for this class on that weekday
		const target = slots.find(
			(s) => s.classId === row.classId && s.dayOfWeek === dow && s.period === period
		);
		if (!target) return fail(400, { moveError: 'That period is not timetabled for this class' });

		// Enforce free period — refuse if the class already has a lesson there (unless it's the same one)
		const [clash] = await db
			.select({ id: scheduledLesson.id })
			.from(scheduledLesson)
			.where(
				and(
					eq(scheduledLesson.userId, userId),
					eq(scheduledLesson.classId, row.classId),
					eq(scheduledLesson.date, date),
					eq(scheduledLesson.period, period)
				)
			);
		if (clash && clash.id !== id) return fail(400, { moveError: 'That period is already taken' });

		await moveScheduledLesson(userId, id, date, period, target.room);
	}
};
