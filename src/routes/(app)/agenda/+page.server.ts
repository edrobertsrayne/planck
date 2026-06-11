import { gte, and, eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { requireUserId } from '$lib/server/session';
import { db } from '$lib/server/db';
import { scheduledLesson, klass, course } from '$lib/server/db/schema';
import { todayIso } from '$lib/server/queries/schedule';
import { getConfig, getBlocks, getClosures } from '$lib/server/queries/timetable';
import { listTeachingDays } from '$lib/scheduling/teaching-days';
import { resolveWeekLetters, weekLetterForDate } from '$lib/scheduling/week-letter';
import { groupByDate } from '$lib/scheduling/week-label';

export const load: PageServerLoad = async (event) => {
	const userId = requireUserId(event);
	const today = todayIso();

	const rows = await db
		.select({
			id: scheduledLesson.id,
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

	const groups = groupByDate(rows).map((g) => ({
		...g,
		weekLetter: weekLetterForDate(g.date, weekMap)
	}));
	return { groups };
};
