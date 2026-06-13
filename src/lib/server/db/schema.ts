import { pgTable, serial, integer, text, date, unique } from 'drizzle-orm/pg-core';
import { user } from './auth.schema';

// One row per teacher.
export const timetableConfig = pgTable('timetable_config', {
	id: serial('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.unique()
		.references(() => user.id, { onDelete: 'cascade' }),
	cycleWeeks: integer('cycle_weeks').notNull().default(2),
	teachingDays: integer('teaching_days').array().notNull().default([1, 2, 3, 4, 5]),
	periodsPerDay: integer('periods_per_day').notNull().default(5),
	anchorLetter: text('anchor_letter').notNull().default('A')
});

export const teachingBlock = pgTable('teaching_block', {
	id: serial('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	startDate: date('start_date', { mode: 'string' }).notNull(),
	endDate: date('end_date', { mode: 'string' }).notNull()
});

export const closureDay = pgTable(
	'closure_day',
	{
		id: serial('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		date: date('date', { mode: 'string' }).notNull()
	},
	(t) => [unique().on(t.userId, t.date)]
);

export const course = pgTable('course', {
	id: serial('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	colour: text('colour').notNull().default('#3884ff')
});

export const module = pgTable('module', {
	id: serial('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	courseId: integer('course_id')
		.notNull()
		.references(() => course.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	orderIndex: integer('order_index').notNull().default(0)
});

export const lesson = pgTable('lesson', {
	id: serial('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	moduleId: integer('module_id')
		.notNull()
		.references(() => module.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	orderIndex: integer('order_index').notNull().default(0)
});

export const klass = pgTable('class', {
	id: serial('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	courseId: integer('course_id')
		.notNull()
		.references(() => course.id, { onDelete: 'cascade' })
});

export const timetableSlot = pgTable(
	'timetable_slot',
	{
		id: serial('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
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
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		classId: integer('class_id')
			.notNull()
			.references(() => klass.id, { onDelete: 'cascade' }),
		lessonId: integer('lesson_id')
			.notNull()
			.references(() => lesson.id, { onDelete: 'cascade' }),
		// Stored for efficient unscheduleModule (delete all lessons for a module+class).
		moduleId: integer('module_id')
			.notNull()
			.references(() => module.id, { onDelete: 'cascade' }),
		date: date('date', { mode: 'string' }).notNull(),
		period: integer('period').notNull(),
		title: text('title').notNull(),
		room: text('room').notNull().default('')
	},
	(t) => [unique().on(t.userId, t.classId, t.date, t.period)]
);

export * from './auth.schema';
