import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// ============================================================================
// Exam Specifications
// ============================================================================

/**
 * Exam specification boards and levels.
 * Predefined read-only reference data for UK Physics exam boards.
 * GCSE: AQA, OCR Gateway, OCR 21st Century, Edexcel, WJEC/Eduqas
 * A-Level: AQA, OCR A, OCR B, Edexcel, WJEC/Eduqas
 */
export const examSpec = sqliteTable('exam_spec', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	/** Exam board name (e.g., "AQA", "OCR Gateway", "Edexcel") */
	board: text('board').notNull(),
	/** Qualification level: "GCSE" or "A-Level" */
	level: text('level', { enum: ['GCSE', 'A-Level'] }).notNull(),
	/** Full specification name (e.g., "AQA GCSE Physics (8463)") */
	name: text('name').notNull(),
	/** Official specification code if applicable */
	specCode: text('spec_code'),
	/** Year the specification was introduced or last updated */
	specYear: text('spec_year'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

/**
 * Hierarchical topics within an exam specification.
 * Topics can contain sub-topics via parentId self-reference.
 */
export const topic = sqliteTable('topic', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	/** Reference to the exam specification */
	examSpecId: text('exam_spec_id')
		.notNull()
		.references(() => examSpec.id, { onDelete: 'cascade' }),
	/** Parent topic for hierarchical structure (null for root topics) */
	parentId: text('parent_id').references((): ReturnType<typeof text> => topic.id, {
		onDelete: 'cascade'
	}),
	/** Topic name (e.g., "Energy", "Forces", "Waves") */
	name: text('name').notNull(),
	/** Topic number/code in the specification (e.g., "4.1", "4.1.1") */
	code: text('code'),
	/** Description or overview of the topic */
	description: text('description'),
	/** Order within parent for display sequencing */
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

/**
 * Individual specification points within a topic.
 * These are the specific content statements that must be taught.
 */
export const specPoint = sqliteTable('spec_point', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	/** Reference to the containing topic */
	topicId: text('topic_id')
		.notNull()
		.references(() => topic.id, { onDelete: 'cascade' }),
	/** Specification point reference code (e.g., "4.1.1.2") */
	reference: text('reference').notNull(),
	/** The actual content statement from the specification */
	content: text('content').notNull(),
	/** Additional notes or clarifications */
	notes: text('notes'),
	/** Whether this is a required or higher-tier only point */
	tier: text('tier', { enum: ['foundation', 'higher', 'both'] }).default('both'),
	/** Order within topic for display sequencing */
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

// ============================================================================
// Classes
// ============================================================================

/**
 * Teaching class/group with exam specification and timetable information.
 * Classes represent a teaching group that is assigned to an exam specification.
 */
export const teachingClass = sqliteTable('class', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	/** Display name (e.g., "11X/Ph1", "Year 12 Physics") */
	name: text('name').notNull(),
	/** Academic year group (7-13) */
	yearGroup: integer('year_group').notNull(),
	/** Reference to the exam specification this class is studying */
	examSpecId: text('exam_spec_id')
		.notNull()
		.references(() => examSpec.id, { onDelete: 'restrict' }),
	/** Academic year in format "YYYY-YY" (e.g., "2024-25") */
	academicYear: text('academic_year').notNull(),
	/** Optional number of students in the class */
	studentCount: integer('student_count'),
	/** Optional default teaching room */
	room: text('room'),
	/** Optional free-text notes about the class */
	notes: text('notes'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
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
export const timetableConfig = sqliteTable('timetable_config', {
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
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

/**
 * Timetable slots for a class.
 * Defines when a class is scheduled during the timetable cycle.
 */
export const timetableSlot = sqliteTable('timetable_slot', {
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
	week: text('week', { enum: ['A', 'B'] }),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

// ============================================================================
// Modules and Lessons
// ============================================================================

/**
 * Module is a reusable template for a planned sequence of lessons.
 * Modules are copied when assigned to a class.
 */
export const module = sqliteTable('module', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	/** Module title (e.g., "Forces and Motion") */
	name: text('name').notNull(),
	/** Optional overview of the module */
	description: text('description'),
	/** Optional reference to target exam specification */
	targetSpecId: text('target_spec_id').references(() => examSpec.id, { onDelete: 'set null' }),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

/**
 * Lesson within a module.
 * Lessons are templates that get copied when a module is assigned to a class.
 */
export const lesson = sqliteTable('lesson', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	/** Reference to the containing module */
	moduleId: text('module_id')
		.notNull()
		.references(() => module.id, { onDelete: 'cascade' }),
	/** Lesson title */
	title: text('title').notNull(),
	/** Optional markdown-formatted lesson notes/content */
	content: text('content'),
	/** Number of periods this lesson takes (default: 1) */
	duration: integer('duration').notNull().default(1),
	/** Order of this lesson within the module for sequencing */
	order: integer('order').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

/**
 * Junction table linking lessons to specification points.
 * A lesson can cover multiple spec points.
 */
export const lessonSpecPoint = sqliteTable('lesson_spec_point', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	/** Reference to the lesson */
	lessonId: text('lesson_id')
		.notNull()
		.references(() => lesson.id, { onDelete: 'cascade' }),
	/** Reference to the specification point */
	specPointId: text('spec_point_id')
		.notNull()
		.references(() => specPoint.id, { onDelete: 'cascade' }),
	createdAt: integer('created_at', { mode: 'timestamp' })
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
export const moduleAssignment = sqliteTable('module_assignment', {
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
	startDate: integer('start_date', { mode: 'timestamp' }).notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

/**
 * Scheduled lesson - a concrete instance of a lesson placed on the calendar.
 * Created by copying a lesson from a module when it's assigned to a class.
 * Scheduled lessons are independent and can be edited without affecting the source module.
 */
export const scheduledLesson = sqliteTable('scheduled_lesson', {
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
	calendarDate: integer('calendar_date', { mode: 'timestamp' }).notNull(),
	/** Reference to the timetable slot (null if manually scheduled) */
	timetableSlotId: text('timetable_slot_id').references(() => timetableSlot.id, {
		onDelete: 'set null'
	}),
	/** Lesson title (copied from source, can be edited) */
	title: text('title').notNull(),
	/** Lesson content in markdown (copied from source, can be edited) */
	content: text('content'),
	/** Number of periods (copied from source, can be edited) */
	duration: integer('duration').notNull().default(1),
	/** Order within the module assignment for sequencing */
	order: integer('order').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

/**
 * Junction table linking scheduled lessons to specification points.
 * Copied from the source lesson when created, but can be edited independently.
 */
export const scheduledLessonSpecPoint = sqliteTable('scheduled_lesson_spec_point', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	/** Reference to the scheduled lesson */
	scheduledLessonId: text('scheduled_lesson_id')
		.notNull()
		.references(() => scheduledLesson.id, { onDelete: 'cascade' }),
	/** Reference to the specification point */
	specPointId: text('spec_point_id')
		.notNull()
		.references(() => specPoint.id, { onDelete: 'cascade' }),
	createdAt: integer('created_at', { mode: 'timestamp' })
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
export const calendarEvent = sqliteTable('calendar_event', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	/** Type of event: holiday (term breaks, bank holidays), closure (INSET, snow days), or absence (teacher absence) */
	type: text('type', { enum: ['holiday', 'closure', 'absence'] }).notNull(),
	/** Title/name of the event (e.g., "Half Term", "INSET Day", "Teacher Absence") */
	title: text('title').notNull(),
	/** Start date of the event */
	startDate: integer('start_date', { mode: 'timestamp' }).notNull(),
	/** End date of the event (inclusive) */
	endDate: integer('end_date', { mode: 'timestamp' }).notNull(),
	/** Whether this event affects all classes (true) or specific classes (false) */
	affectsAllClasses: integer('affects_all_classes', { mode: 'boolean' }).notNull().default(true),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

// ============================================================================
// Attachments
// ============================================================================

/**
 * Attachments for various entities in the system.
 * Supports both file uploads and link attachments with polymorphic associations.
 * Entities that can have attachments: specifications, classes, modules, lessons, and scheduled lessons.
 */
export const attachment = sqliteTable('attachment', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	/** Type of attachment: file (uploaded) or link (URL) */
	type: text('type', { enum: ['file', 'link'] }).notNull(),
	/** Entity type this attachment belongs to */
	entityType: text('entity_type', {
		enum: ['class', 'module', 'lesson', 'scheduledLesson', 'spec']
	}).notNull(),
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
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});
