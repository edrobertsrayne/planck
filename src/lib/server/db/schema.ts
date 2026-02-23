import { boolean, integer, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

// ============================================================================
// Enums
// ============================================================================

export const timetableWeekEnum = pgEnum('timetable_week', ['A', 'B']);
export const calendarEventTypeEnum = pgEnum('calendar_event_type', [
	'holiday',
	'closure',
	'absence'
]);
export const attachmentTypeEnum = pgEnum('attachment_type', ['file', 'link']);
export const attachmentEntityTypeEnum = pgEnum('attachment_entity_type', [
	'class',
	'module',
	'lesson',
	'scheduledLesson',
	'course'
]);

// ============================================================================
// Courses
// ============================================================================

/**
 * Course is a top-level container for modules.
 * Examples: "GCSE Physics", "Year 9 Physics", "A-Level Physics"
 */
export const course = pgTable('course', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	/** Course name (e.g., "GCSE Physics", "Year 9 Physics") */
	name: text('name').notNull(),
	/** Rich notes stored as Editor.js JSON */
	notes: text('notes'),
	createdAt: timestamp('created_at', { mode: 'date' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: timestamp('updated_at', { mode: 'date' })
		.notNull()
		.$defaultFn(() => new Date())
});

// ============================================================================
// Classes
// ============================================================================

/**
 * Teaching class/group optionally linked to a course.
 * Classes represent a teaching group for a specific academic year.
 */
export const teachingClass = pgTable('class', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	/** Display name (e.g., "11X/Ph1", "Year 12 Physics") */
	name: text('name').notNull(),
	/** Academic year group (7-13) */
	yearGroup: integer('year_group').notNull(),
	/** Optional reference to the course this class is studying */
	courseId: text('course_id').references(() => course.id, { onDelete: 'set null' }),
	/** Academic year in format "YYYY-YY" (e.g., "2024-25") */
	academicYear: text('academic_year').notNull(),
	/** Optional number of students in the class */
	studentCount: integer('student_count'),
	/** Optional default teaching room */
	room: text('room'),
	/** Optional free-text notes about the class */
	notes: text('notes'),
	createdAt: timestamp('created_at', { mode: 'date' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: timestamp('updated_at', { mode: 'date' })
		.notNull()
		.$defaultFn(() => new Date())
});

// ============================================================================
// Timetable Configuration
// ============================================================================

/**
 * Timetable configuration for an academic year.
 * Defines the structure of the school timetable.
 *
 * SPECIAL CONVENTION: A record with academicYear = 'GLOBAL' stores school-wide settings:
 * - weeks: Applies to all academic years (school-wide timetable type)
 * Year-specific records (academicYear = "YYYY-YY") store:
 * - periodsPerDay and daysPerWeek: Vary by academic year
 */
export const timetableConfig = pgTable('timetable_config', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	/** Academic year in format "YYYY-YY" (e.g., "2024-25") or "GLOBAL" for school-wide settings */
	academicYear: text('academic_year').notNull().unique(),
	/** Number of weeks in the timetable cycle: 1 (standard) or 2 (Week A/B). Stored in GLOBAL record for school-wide application */
	weeks: integer('weeks').notNull().default(1),
	/** Number of periods per day (1-10). Stored in year-specific records */
	periodsPerDay: integer('periods_per_day').notNull().default(6),
	/** Number of days per week (1-7, typically 5 for Mon-Fri). Stored in year-specific records */
	daysPerWeek: integer('days_per_week').notNull().default(5),
	createdAt: timestamp('created_at', { mode: 'date' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: timestamp('updated_at', { mode: 'date' })
		.notNull()
		.$defaultFn(() => new Date())
});

/**
 * Timetable slots for a class.
 * Defines when a class is scheduled during the timetable cycle.
 */
export const timetableSlot = pgTable('timetable_slot', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	/** Reference to the class this slot belongs to */
	classId: text('class_id')
		.notNull()
		.references(() => teachingClass.id, { onDelete: 'cascade' }),
	/** Day of the week (1 = Monday, 7 = Sunday) */
	day: integer('day').notNull(),
	/** Starting period for this slot (1-based) */
	periodStart: integer('period_start').notNull(),
	/** Ending period for this slot (same as start for single, higher for doubles) */
	periodEnd: integer('period_end').notNull(),
	/** Week identifier for 2-week timetables: 'A', 'B', or null for 1-week timetables */
	week: timetableWeekEnum('week'),
	createdAt: timestamp('created_at', { mode: 'date' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: timestamp('updated_at', { mode: 'date' })
		.notNull()
		.$defaultFn(() => new Date())
});

// ============================================================================
// Modules and Lessons
// ============================================================================

/**
 * Module is a reusable template for a planned sequence of lessons.
 * Modules belong to a course and are copied when assigned to a class.
 */
export const module = pgTable('module', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	/** Module title (e.g., "Forces and Motion") */
	name: text('name').notNull(),
	/** Reference to the course this module belongs to */
	courseId: text('course_id')
		.notNull()
		.references(() => course.id, { onDelete: 'cascade' }),
	/** Rich notes stored as Editor.js JSON */
	notes: text('notes'),
	createdAt: timestamp('created_at', { mode: 'date' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: timestamp('updated_at', { mode: 'date' })
		.notNull()
		.$defaultFn(() => new Date())
});

/**
 * Lesson within a module.
 * Lessons are templates that get copied when a module is assigned to a class.
 */
export const lesson = pgTable('lesson', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	/** Reference to the containing module */
	moduleId: text('module_id')
		.notNull()
		.references(() => module.id, { onDelete: 'cascade' }),
	/** Lesson title */
	title: text('title').notNull(),
	/** Rich content stored as Editor.js JSON */
	content: text('content'),
	/** Number of periods this lesson takes (default: 1) */
	duration: integer('duration').notNull().default(1),
	/** Order of this lesson within the module for sequencing */
	order: integer('order').notNull(),
	createdAt: timestamp('created_at', { mode: 'date' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: timestamp('updated_at', { mode: 'date' })
		.notNull()
		.$defaultFn(() => new Date())
});

// ============================================================================
// Module Assignments and Scheduled Lessons
// ============================================================================

/**
 * Module assignment to a class.
 * When a module is assigned to a class, its lessons are copied to scheduled lessons.
 */
export const moduleAssignment = pgTable('module_assignment', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	/** Reference to the class this module is assigned to */
	classId: text('class_id')
		.notNull()
		.references(() => teachingClass.id, { onDelete: 'cascade' }),
	/** Reference to the source module (template) */
	moduleId: text('module_id')
		.notNull()
		.references(() => module.id, { onDelete: 'restrict' }),
	/** Date when the module assignment starts */
	startDate: timestamp('start_date', { mode: 'date' }).notNull(),
	createdAt: timestamp('created_at', { mode: 'date' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: timestamp('updated_at', { mode: 'date' })
		.notNull()
		.$defaultFn(() => new Date())
});

/**
 * Scheduled lesson - a concrete instance of a lesson placed on the calendar.
 * Created by copying a lesson from a module when it's assigned to a class.
 * Scheduled lessons are independent and can be edited without affecting the source module.
 */
export const scheduledLesson = pgTable('scheduled_lesson', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	/** Reference to the module assignment this lesson belongs to */
	assignmentId: text('assignment_id')
		.notNull()
		.references(() => moduleAssignment.id, { onDelete: 'cascade' }),
	/** Reference to the source lesson (for tracking) */
	lessonId: text('lesson_id')
		.notNull()
		.references(() => lesson.id, { onDelete: 'restrict' }),
	/** Calendar date when this lesson is scheduled */
	calendarDate: timestamp('calendar_date', { mode: 'date' }).notNull(),
	/** Reference to the timetable slot (null if manually scheduled) */
	timetableSlotId: text('timetable_slot_id').references(() => timetableSlot.id, {
		onDelete: 'set null'
	}),
	/** Lesson title (copied from source, can be edited) */
	title: text('title').notNull(),
	/** Rich content stored as Editor.js JSON (copied from source, can be edited) */
	content: text('content'),
	/** Number of periods (copied from source, can be edited) */
	duration: integer('duration').notNull().default(1),
	/** Order within the module assignment for sequencing */
	order: integer('order').notNull(),
	createdAt: timestamp('created_at', { mode: 'date' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: timestamp('updated_at', { mode: 'date' })
		.notNull()
		.$defaultFn(() => new Date())
});

// ============================================================================
// Calendar Events
// ============================================================================

/**
 * Calendar events including holidays, closures, and absences.
 * These events trigger automatic lesson rescheduling when they overlap scheduled lessons.
 */
export const calendarEvent = pgTable('calendar_event', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	/** Type of event: holiday (term breaks, bank holidays), closure (INSET, snow days), or absence (teacher absence) */
	type: calendarEventTypeEnum('type').notNull(),
	/** Title/name of the event (e.g., "Half Term", "INSET Day", "Teacher Absence") */
	title: text('title').notNull(),
	/** Start date of the event */
	startDate: timestamp('start_date', { mode: 'date' }).notNull(),
	/** End date of the event (inclusive) */
	endDate: timestamp('end_date', { mode: 'date' }).notNull(),
	/** Whether this event affects all classes (true) or specific classes (false) */
	affectsAllClasses: boolean('affects_all_classes').notNull().default(true),
	createdAt: timestamp('created_at', { mode: 'date' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: timestamp('updated_at', { mode: 'date' })
		.notNull()
		.$defaultFn(() => new Date())
});

// ============================================================================
// Attachments
// ============================================================================

/**
 * Attachments for various entities in the system.
 * Supports both file uploads and link attachments with polymorphic associations.
 * Entities that can have attachments: courses, classes, modules, lessons, and scheduled lessons.
 */
export const attachment = pgTable('attachment', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	/** Type of attachment: file (uploaded) or link (URL) */
	type: attachmentTypeEnum('type').notNull(),
	/** Entity type this attachment belongs to */
	entityType: attachmentEntityTypeEnum('entity_type').notNull(),
	/** ID of the entity this attachment belongs to (polymorphic) */
	entityId: text('entity_id').notNull(),
	/** File path for uploaded files (relative to configured uploads directory) */
	filePath: text('file_path'),
	/** URL for link attachments */
	url: text('url'),
	/** Original file name or link title */
	fileName: text('file_name'),
	/** MIME type for files (e.g., application/pdf, image/png) */
	mimeType: text('mime_type'),
	createdAt: timestamp('created_at', { mode: 'date' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: timestamp('updated_at', { mode: 'date' })
		.notNull()
		.$defaultFn(() => new Date())
});
