import { pgTable, serial, integer, text, date, unique, boolean } from 'drizzle-orm/pg-core';

// One row per teacher.
export const timetableConfig = pgTable('timetable_config', {
	id: serial('id').primaryKey(),
	userId: text('user_id').notNull().unique(),
	cycleWeeks: integer('cycle_weeks').notNull().default(2),
	teachingDays: integer('teaching_days').array().notNull().default([1, 2, 3, 4, 5]),
	periodsPerDay: integer('periods_per_day').notNull().default(5),
	anchorLetter: text('anchor_letter').notNull().default('A')
});

export const teachingBlock = pgTable('teaching_block', {
	id: serial('id').primaryKey(),
	userId: text('user_id').notNull(),
	name: text('name').notNull(),
	startDate: date('start_date', { mode: 'string' }).notNull(),
	endDate: date('end_date', { mode: 'string' }).notNull()
});

export const closureDay = pgTable(
	'closure_day',
	{
		id: serial('id').primaryKey(),
		userId: text('user_id').notNull(),
		date: date('date', { mode: 'string' }).notNull(),
		name: text('name').notNull().default('')
	},
	(t) => [unique().on(t.userId, t.date)]
);

export const course = pgTable('course', {
	id: serial('id').primaryKey(),
	userId: text('user_id').notNull(),
	name: text('name').notNull(),
	colour: text('colour').notNull().default('#3884ff')
});

export const module = pgTable('module', {
	id: serial('id').primaryKey(),
	userId: text('user_id').notNull(),
	courseId: integer('course_id')
		.notNull()
		.references(() => course.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	orderIndex: integer('order_index').notNull().default(0),
	description: text('description').notNull().default('')
});

export const lesson = pgTable('lesson', {
	id: serial('id').primaryKey(),
	userId: text('user_id').notNull(),
	moduleId: integer('module_id')
		.notNull()
		.references(() => module.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	orderIndex: integer('order_index').notNull().default(0),
	plan: text('plan').notNull().default(''),
	note: text('note').notNull().default('')
});

export const klass = pgTable('class', {
	id: serial('id').primaryKey(),
	userId: text('user_id').notNull(),
	name: text('name').notNull(),
	courseId: integer('course_id')
		.notNull()
		.references(() => course.id, { onDelete: 'cascade' }),
	colour: text('colour').notNull().default('#8775c6')
});

export const timetableSlot = pgTable(
	'timetable_slot',
	{
		id: serial('id').primaryKey(),
		userId: text('user_id').notNull(),
		weekLetter: text('week_letter').notNull(),
		dayOfWeek: integer('day_of_week').notNull(),
		period: integer('period').notNull(),
		classId: integer('class_id')
			.notNull()
			.references(() => klass.id, { onDelete: 'cascade' }),
		room: text('room').notNull().default('')
	},
	(t) => [unique().on(t.userId, t.weekLetter, t.dayOfWeek, t.period)]
);

export const scheduledLesson = pgTable(
	'scheduled_lesson',
	{
		id: serial('id').primaryKey(),
		userId: text('user_id').notNull(),
		classId: integer('class_id')
			.notNull()
			.references(() => klass.id, { onDelete: 'cascade' }),
		// Nullable: null = a blank inserted spacer with no underlying lesson template,
		// or a row detached when its template lesson/module was deleted.
		lessonId: integer('lesson_id').references(() => lesson.id, { onDelete: 'set null' }),
		moduleId: integer('module_id').references(() => module.id, { onDelete: 'set null' }),
		// Sequence position within the class. The class's ordered list is the source of truth.
		orderIndex: integer('order_index').notNull().default(0),
		// Nullable: null = overflow (not yet allocated to a timetabled slot).
		date: date('date', { mode: 'string' }),
		period: integer('period'),
		title: text('title').notNull(),
		room: text('room').notNull().default(''),
		plan: text('plan').notNull().default(''),
		note: text('note').notNull().default(''),
		done: boolean('done').notNull().default(false),
		postponed: boolean('postponed').notNull().default(false)
	},
	(t) => [unique().on(t.userId, t.classId, t.date, t.period)]
);

export const resourceLink = pgTable('resource_link', {
	id: serial('id').primaryKey(),
	userId: text('user_id').notNull(),
	// Exactly one of lessonId / scheduledLessonId / courseId / moduleId is set
	// (enforced in app code via ownerColumns()).
	lessonId: integer('lesson_id').references(() => lesson.id, { onDelete: 'cascade' }),
	scheduledLessonId: integer('scheduled_lesson_id').references(() => scheduledLesson.id, {
		onDelete: 'cascade'
	}),
	courseId: integer('course_id').references(() => course.id, { onDelete: 'cascade' }),
	moduleId: integer('module_id').references(() => module.id, { onDelete: 'cascade' }),
	url: text('url').notNull(),
	label: text('label'),
	orderIndex: integer('order_index').notNull().default(0)
});

export const resourceFile = pgTable('resource_file', {
	id: serial('id').primaryKey(),
	userId: text('user_id').notNull(),
	// Exactly one of lessonId / scheduledLessonId / courseId / moduleId is set.
	lessonId: integer('lesson_id').references(() => lesson.id, { onDelete: 'cascade' }),
	scheduledLessonId: integer('scheduled_lesson_id').references(() => scheduledLesson.id, {
		onDelete: 'cascade'
	}),
	courseId: integer('course_id').references(() => course.id, { onDelete: 'cascade' }),
	moduleId: integer('module_id').references(() => module.id, { onDelete: 'cascade' }),
	blobUrl: text('blob_url').notNull(),
	pathname: text('pathname').notNull(),
	filename: text('filename').notNull(),
	contentType: text('content_type').notNull(),
	size: integer('size').notNull(),
	orderIndex: integer('order_index').notNull().default(0)
});
