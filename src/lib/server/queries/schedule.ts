import { eq, and, sql, lt, gte, or, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	scheduledLesson,
	klass,
	course,
	lesson,
	lessonLink,
	lessonFile
} from '$lib/server/db/schema';
import { buildCopiedLinkRows, buildCopiedFileRows } from '$lib/resources/copy';
import { copyBlob } from '$lib/server/blob';
import { getConfig, getBlocks, getClosures, getSlots } from './timetable';
import { getModule, listLessons } from './courses';
import { getClass } from './classes';
import { classPeriodStream } from '$lib/scheduling/periods';
import { allocateSequence } from '$lib/scheduling/allocate';
import type { SlotData } from '$lib/scheduling/types';

export function todayIso(): string {
	return new Date().toISOString().slice(0, 10);
}

interface TimetableInputs {
	config: Awaited<ReturnType<typeof getConfig>>;
	blocks: Awaited<ReturnType<typeof getBlocks>>;
	closures: Awaited<ReturnType<typeof getClosures>>;
	slots: Awaited<ReturnType<typeof getSlots>>;
}

async function loadTimetableInputs(userId: string): Promise<TimetableInputs> {
	const [config, blocks, closures, slots] = await Promise.all([
		getConfig(userId),
		getBlocks(userId),
		getClosures(userId),
		getSlots(userId)
	]);
	return { config, blocks, closures, slots };
}

/**
 * Re-derive date/period/room for a class's sequence from its future slot stream,
 * using already-fetched timetable inputs. Frozen (already-taught) rows are left
 * untouched.
 */
async function reallocateClassWith(
	userId: string,
	classId: number,
	inputs: TimetableInputs,
	today: string
): Promise<void> {
	const items = await db
		.select({ id: scheduledLesson.id, date: scheduledLesson.date })
		.from(scheduledLesson)
		.where(and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.classId, classId)))
		.orderBy(scheduledLesson.orderIndex);

	const stream = classPeriodStream(
		inputs.config,
		inputs.blocks.map((b) => ({ startDate: b.startDate, endDate: b.endDate })),
		inputs.closures.map((c) => c.date),
		inputs.slots as SlotData[],
		classId
	).filter((o) => o.date >= today);

	const allocations = allocateSequence(items, stream, today);
	if (allocations.length === 0) return;

	// neon-http has no interactive transactions; db.batch runs these atomically in one request.
	// Two passes (clear all, then set) avoid transient (date, period) unique-constraint collisions.
	const clears = allocations.map((a) =>
		db
			.update(scheduledLesson)
			.set({ date: null, period: null, room: '' })
			.where(and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.id, a.id)))
	);
	const sets = allocations.map((a) =>
		db
			.update(scheduledLesson)
			.set({ date: a.date, period: a.period, room: a.room })
			.where(and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.id, a.id)))
	);
	const statements = [...clears, ...sets];
	await db.batch(statements as [(typeof statements)[number], ...(typeof statements)[number][]]);
}

/**
 * Re-derive date/period/room for a class's sequence from its future slot stream.
 * The single source of allocation.
 */
export async function reallocateClass(
	userId: string,
	classId: number,
	today: string = todayIso()
): Promise<void> {
	const inputs = await loadTimetableInputs(userId);
	await reallocateClassWith(userId, classId, inputs, today);
}

/** Reallocate every class for a user (used after timetable-wide changes). */
export async function reallocateAllClasses(
	userId: string,
	today: string = todayIso()
): Promise<void> {
	const inputs = await loadTimetableInputs(userId);
	const classes = await db.select({ id: klass.id }).from(klass).where(eq(klass.userId, userId));
	await Promise.all(classes.map((c) => reallocateClassWith(userId, c.id, inputs, today)));
}

/**
 * Copy a template lesson's plan + links + files onto a freshly created scheduled
 * lesson. Blobs are physically copied so the two are fully independent. Runs once
 * at schedule time; later edits on either side do not propagate.
 */
async function copyLessonContent(
	userId: string,
	templateLessonId: number,
	scheduledLessonId: number
): Promise<void> {
	const [tpl] = await db
		.select({ plan: lesson.plan })
		.from(lesson)
		.where(and(eq(lesson.userId, userId), eq(lesson.id, templateLessonId)));
	if (tpl?.plan) {
		await db
			.update(scheduledLesson)
			.set({ plan: tpl.plan })
			.where(and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.id, scheduledLessonId)));
	}

	const links = await db
		.select({ url: lessonLink.url, label: lessonLink.label, orderIndex: lessonLink.orderIndex })
		.from(lessonLink)
		.where(and(eq(lessonLink.userId, userId), eq(lessonLink.lessonId, templateLessonId)))
		.orderBy(lessonLink.orderIndex);
	if (links.length > 0) {
		await db.insert(lessonLink).values(buildCopiedLinkRows(links, userId, scheduledLessonId));
	}

	const files = await db
		.select({
			blobUrl: lessonFile.blobUrl,
			pathname: lessonFile.pathname,
			filename: lessonFile.filename,
			contentType: lessonFile.contentType,
			size: lessonFile.size,
			orderIndex: lessonFile.orderIndex
		})
		.from(lessonFile)
		.where(and(eq(lessonFile.userId, userId), eq(lessonFile.lessonId, templateLessonId)))
		.orderBy(lessonFile.orderIndex);
	if (files.length > 0) {
		const copies = await Promise.all(
			files.map((f) =>
				copyBlob(f.blobUrl, `lesson-files/${userId}/${crypto.randomUUID()}-${f.filename}`)
			)
		);
		await db
			.insert(lessonFile)
			.values(buildCopiedFileRows(files, copies, userId, scheduledLessonId));
	}
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

	const lessons = await listLessons(userId, moduleId);
	if (lessons.length === 0)
		return { scheduled: 0, unscheduled: 0, firstDate: null, lastDate: null };

	const [{ next }] = await db
		.select({ next: sql<number>`coalesce(max(${scheduledLesson.orderIndex}) + 1, 0)` })
		.from(scheduledLesson)
		.where(and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.classId, classId)));

	for (let i = 0; i < lessons.length; i++) {
		const l = lessons[i];
		const [inserted] = await db
			.insert(scheduledLesson)
			.values({
				userId,
				classId,
				lessonId: l.id,
				moduleId,
				title: l.title,
				orderIndex: next + i,
				date: null,
				period: null,
				room: ''
			})
			.returning({ id: scheduledLesson.id });
		await copyLessonContent(userId, l.id, inserted.id);
	}

	await reallocateClass(userId, classId, today);

	const placed = await db
		.select({ date: scheduledLesson.date })
		.from(scheduledLesson)
		.where(
			and(
				eq(scheduledLesson.userId, userId),
				eq(scheduledLesson.classId, classId),
				eq(scheduledLesson.moduleId, moduleId)
			)
		)
		.orderBy(scheduledLesson.orderIndex);
	const dated = placed.map((p) => p.date).filter((d): d is string => d !== null);
	return {
		scheduled: dated.length,
		unscheduled: placed.length - dated.length,
		firstDate: dated[0] ?? null,
		lastDate: dated.at(-1) ?? null
	};
}

export async function unscheduleModule(
	userId: string,
	moduleId: number,
	classId: number,
	today: string = todayIso()
): Promise<void> {
	await db
		.delete(scheduledLesson)
		.where(
			and(
				eq(scheduledLesson.userId, userId),
				eq(scheduledLesson.moduleId, moduleId),
				eq(scheduledLesson.classId, classId)
			)
		);
	await reallocateClass(userId, classId, today);
}

/**
 * Agenda's one-off manual move: sets a concrete date/period directly. This is
 * deliberately NOT reflowed through reallocateClass — a later reallocation (e.g.
 * after a timetable edit) will overwrite it. Known, accepted limitation.
 */
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

/** The class's editable sequence: overflow rows + rows on/after today, in order. */
export function listClassSequence(userId: string, classId: number, today: string = todayIso()) {
	return db
		.select({
			id: scheduledLesson.id,
			orderIndex: scheduledLesson.orderIndex,
			date: scheduledLesson.date,
			period: scheduledLesson.period,
			room: scheduledLesson.room,
			title: scheduledLesson.title
		})
		.from(scheduledLesson)
		.where(
			and(
				eq(scheduledLesson.userId, userId),
				eq(scheduledLesson.classId, classId),
				or(isNull(scheduledLesson.date), gte(scheduledLesson.date, today))
			)
		)
		.orderBy(scheduledLesson.orderIndex);
}

/** Renumber the visible (flow) rows after the frozen past prefix, in given order. */
export async function reorderSequence(
	userId: string,
	classId: number,
	orderedIds: number[],
	today: string = todayIso()
): Promise<void> {
	const [{ base }] = await db
		.select({ base: sql<number>`coalesce(max(${scheduledLesson.orderIndex}), -1)` })
		.from(scheduledLesson)
		.where(
			and(
				eq(scheduledLesson.userId, userId),
				eq(scheduledLesson.classId, classId),
				lt(scheduledLesson.date, today) // frozen past only (null dates excluded)
			)
		);
	const updates = orderedIds.map((id, i) =>
		db
			.update(scheduledLesson)
			.set({ orderIndex: base + 1 + i })
			.where(and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.id, id)))
	);
	if (updates.length > 0) {
		await db.batch(updates as [(typeof updates)[number], ...(typeof updates)[number][]]);
	}
	await reallocateClass(userId, classId, today);
}

/** Insert a blank spacer; rows at/after atOrderIndex shift forward by one. */
export async function insertBlank(
	userId: string,
	classId: number,
	atOrderIndex: number,
	title: string,
	today: string = todayIso()
): Promise<void> {
	await db.batch([
		db
			.update(scheduledLesson)
			.set({ orderIndex: sql`${scheduledLesson.orderIndex} + 1` })
			.where(
				and(
					eq(scheduledLesson.userId, userId),
					eq(scheduledLesson.classId, classId),
					gte(scheduledLesson.orderIndex, atOrderIndex)
				)
			),
		db.insert(scheduledLesson).values({
			userId,
			classId,
			lessonId: null,
			moduleId: null,
			title,
			orderIndex: atOrderIndex,
			date: null,
			period: null,
			room: ''
		})
	]);
	await reallocateClass(userId, classId, today);
}

/** The orderIndex to append a new blank at the end of the class's sequence. */
export async function nextOrderIndex(userId: string, classId: number): Promise<number> {
	const [{ next }] = await db
		.select({ next: sql<number>`coalesce(max(${scheduledLesson.orderIndex}) + 1, 0)` })
		.from(scheduledLesson)
		.where(and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.classId, classId)));
	return next;
}

/** Look up a row's orderIndex (for inserting a blank above it). */
export async function getOrderIndex(userId: string, id: number): Promise<number | null> {
	const [row] = await db
		.select({ orderIndex: scheduledLesson.orderIndex })
		.from(scheduledLesson)
		.where(and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.id, id)));
	return row?.orderIndex ?? null;
}

/** Delete one row from the sequence; the tail pulls back on reallocate. */
export async function deleteFromSequence(
	userId: string,
	id: number,
	today: string = todayIso()
): Promise<void> {
	const [row] = await db
		.select({ classId: scheduledLesson.classId })
		.from(scheduledLesson)
		.where(and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.id, id)));
	if (!row) return;
	await db
		.delete(scheduledLesson)
		.where(and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.id, id)));
	await reallocateClass(userId, row.classId, today);
}

/** Rename a single scheduled instance (does not touch the lesson template). */
export async function renameScheduledLesson(userId: string, id: number, title: string) {
	return db
		.update(scheduledLesson)
		.set({ title })
		.where(and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.id, id)));
}

/** A scheduled lesson with its class + course context for the lesson page. */
export async function getScheduledLesson(userId: string, id: number) {
	const [row] = await db
		.select({
			id: scheduledLesson.id,
			title: scheduledLesson.title,
			plan: scheduledLesson.plan,
			classId: scheduledLesson.classId,
			className: klass.name,
			courseName: course.name
		})
		.from(scheduledLesson)
		.innerJoin(klass, eq(scheduledLesson.classId, klass.id))
		.innerJoin(course, eq(klass.courseId, course.id))
		.where(and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.id, id)));
	return row ?? null;
}
