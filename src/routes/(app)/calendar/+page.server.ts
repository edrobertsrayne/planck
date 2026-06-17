import { gte, lte, and, eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { requireUserId } from '$lib/server/session';
import { db } from '$lib/server/db';
import { scheduledLesson, klass, course } from '$lib/server/db/schema';
import { getConfig, getBlocks, getClosures } from '$lib/server/queries/timetable';
import { mondayOf, addDays } from '$lib/scheduling/dates';
import { todayIso } from '$lib/server/queries/schedule';
import { listTeachingDays } from '$lib/scheduling/teaching-days';
import { resolveWeekLetters, weekLetterForDate } from '$lib/scheduling/week-letter';

export const load: PageServerLoad = async (event) => {
	const userId = requireUserId(event);
	const startParam = event.url.searchParams.get('start');
	const weekStart = mondayOf(startParam ?? todayIso());
	const weekEnd = addDays(weekStart, 6);
	const thisWeekStart = mondayOf(todayIso());

	const rows = await db
		.select({
			id: scheduledLesson.id,
			classId: scheduledLesson.classId,
			date: scheduledLesson.date,
			period: scheduledLesson.period,
			title: scheduledLesson.title,
			room: scheduledLesson.room,
			className: klass.name,
			colour: course.colour
		})
		.from(scheduledLesson)
		.innerJoin(klass, eq(scheduledLesson.classId, klass.id))
		.innerJoin(course, eq(klass.courseId, course.id))
		.where(
			and(
				eq(scheduledLesson.userId, userId),
				gte(scheduledLesson.date, weekStart),
				lte(scheduledLesson.date, weekEnd)
			)
		);

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

	return {
		config,
		weekStart,
		thisWeekStart,
		prevStart: addDays(weekStart, -7),
		nextStart: addDays(weekStart, 7),
		weekLetter: weekLetterForDate(weekStart, weekMap),
		lessons: rows
	};
};
