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

export * from './auth.schema';
