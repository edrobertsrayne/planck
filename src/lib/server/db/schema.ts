import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Placeholder task table - to be removed once all schema is in place
export const task = sqliteTable('task', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	title: text('title').notNull(),
	priority: integer('priority').notNull().default(1)
});

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
 */
export const timetableConfig = sqliteTable('timetable_config', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	/** Academic year in format "YYYY-YY" (e.g., "2024-25") */
	academicYear: text('academic_year').notNull().unique(),
	/** Number of weeks in the timetable cycle: 1 (standard) or 2 (Week A/B) */
	weeks: integer('weeks').notNull().default(1),
	/** Number of periods per day (1-10) */
	periodsPerDay: integer('periods_per_day').notNull().default(6),
	/** Number of days per week (1-7, typically 5 for Mon-Fri) */
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

export * from './auth.schema';
