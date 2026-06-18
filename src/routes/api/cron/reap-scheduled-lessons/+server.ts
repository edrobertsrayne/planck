import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { scheduledLesson } from '$lib/server/db/schema';
import { getConfig } from '$lib/server/queries/timetable';
import { reapScheduledLessonsBefore, todayIso } from '$lib/server/queries/schedule';
import { academicYearCutoff } from '$lib/scheduling/dates';
import { isAuthorizedCron } from '$lib/server/cron-auth';
import type { RequestHandler } from './$types';

// Global cap per invocation; the daily schedule drains any first-run backlog.
const PER_RUN_CAP = 500;

export const GET: RequestHandler = async ({ request }) => {
	const auth = isAuthorizedCron(request.headers.get('authorization'), env.CRON_SECRET);
	if (!auth.authorized) return new Response(null, { status: auth.status });

	const today = todayIso();
	const users = await db.selectDistinct({ userId: scheduledLesson.userId }).from(scheduledLesson);

	let reaped = 0;
	let remaining = PER_RUN_CAP;
	for (const { userId } of users) {
		if (remaining <= 0) break;
		try {
			const config = await getConfig(userId);
			const cutoff = academicYearCutoff(
				today,
				config.academicYearStartMonth,
				config.academicYearStartDay
			);
			const n = await reapScheduledLessonsBefore(userId, cutoff, remaining);
			reaped += n;
			remaining -= n;
		} catch (err) {
			// Resilient: one user's failure must not abort the whole run.
			console.error('reap failed for user', userId, err);
		}
	}
	return json({ reaped });
};
