import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../../src/lib/server/db/schema';

// Test database path
const TEST_DB_PATH = process.env.TEST_DATABASE_URL || ':memory:';

/**
 * Create a test database connection
 */
export function createTestDb() {
	const sqlite = new Database(TEST_DB_PATH);
	const db = drizzle(sqlite, { schema });
	return { db, sqlite };
}

/**
 * Clean all tables in the database
 */
export function cleanDatabase(sqlite: Database.Database) {
	// Get all table names from schema
	const tables = [
		'scheduled_lesson_spec_point',
		'scheduled_lesson',
		'module_assignment',
		'lesson_spec_point',
		'lesson',
		'module',
		'timetable_slot',
		'timetable_config',
		'class',
		'calendar_event',
		'attachment',
		'spec_point',
		'topic',
		'exam_spec',
		// Auth tables (created by Better Auth)
		'session',
		'account',
		'verification',
		'user'
	];

	// Delete in reverse order to respect foreign key constraints
	for (const table of tables) {
		try {
			sqlite.exec(`DELETE FROM ${table}`);
		} catch {
			// Table might not exist yet, ignore
		}
	}
}

/**
 * Seed exam specifications for testing
 * These are read-only reference data that all tests can use
 */
export async function seedExamSpecs(db: ReturnType<typeof createTestDb>['db']) {
	const { examSpec, topic, specPoint } = schema;

	// Create GCSE AQA spec
	const [gcseSpec] = await db
		.insert(examSpec)
		.values({
			id: 'test-gcse-aqa',
			board: 'AQA',
			level: 'GCSE',
			name: 'AQA GCSE Physics (8463)',
			specCode: '8463',
			specYear: '2016'
		})
		.returning();

	// Create a topic
	const [energyTopic] = await db
		.insert(topic)
		.values({
			id: 'test-topic-energy',
			examSpecId: gcseSpec.id,
			name: 'Energy',
			code: '1',
			sortOrder: 0
		})
		.returning();

	// Create some spec points
	await db.insert(specPoint).values([
		{
			id: 'test-sp-1',
			topicId: energyTopic.id,
			reference: '1.1',
			content: 'Energy stores and systems',
			tier: 'both',
			sortOrder: 0
		},
		{
			id: 'test-sp-2',
			topicId: energyTopic.id,
			reference: '1.2',
			content: 'Changes in energy',
			tier: 'both',
			sortOrder: 1
		}
	]);

	// Create A-Level AQA spec
	const [alevelSpec] = await db
		.insert(examSpec)
		.values({
			id: 'test-alevel-aqa',
			board: 'AQA',
			level: 'A-Level',
			name: 'AQA A-Level Physics (7408)',
			specCode: '7408',
			specYear: '2015'
		})
		.returning();

	// Create a topic for A-Level
	const [mechanicsTopic] = await db
		.insert(topic)
		.values({
			id: 'test-topic-mechanics',
			examSpecId: alevelSpec.id,
			name: 'Mechanics',
			code: '3.1',
			sortOrder: 0
		})
		.returning();

	// Create spec points for A-Level
	await db.insert(specPoint).values([
		{
			id: 'test-sp-3',
			topicId: mechanicsTopic.id,
			reference: '3.1.1',
			content: 'Force, energy and momentum',
			tier: 'both',
			sortOrder: 0
		}
	]);

	return { gcseSpec, alevelSpec, energyTopic, mechanicsTopic };
}

/**
 * Seed timetable configuration for testing
 */
export async function seedTimetableConfig(
	db: ReturnType<typeof createTestDb>['db'],
	academicYear = '2024-25'
) {
	const { timetableConfig } = schema;

	const [config] = await db
		.insert(timetableConfig)
		.values({
			id: 'test-timetable-config',
			academicYear,
			weeks: 2, // Week A/B
			periodsPerDay: 6,
			daysPerWeek: 5
		})
		.returning();

	return config;
}

/**
 * Factory function to create a test class
 */
export async function createTestClass(
	db: ReturnType<typeof createTestDb>['db'],
	data: {
		name: string;
		yearGroup: number;
		examSpecId: string;
		academicYear?: string;
		studentCount?: number;
		room?: string;
	}
) {
	const { teachingClass } = schema;

	const [testClass] = await db
		.insert(teachingClass)
		.values({
			academicYear: '2024-25',
			...data
		})
		.returning();

	return testClass;
}

/**
 * Factory function to create a test module
 */
export async function createTestModule(
	db: ReturnType<typeof createTestDb>['db'],
	data: {
		name: string;
		description?: string;
		targetSpecId?: string;
	}
) {
	const { module } = schema;

	const [testModule] = await db.insert(module).values(data).returning();

	return testModule;
}

/**
 * Factory function to create a test lesson
 */
export async function createTestLesson(
	db: ReturnType<typeof createTestDb>['db'],
	data: {
		moduleId: string;
		title: string;
		content?: string;
		duration?: number;
		order: number;
	}
) {
	const { lesson } = schema;

	const [testLesson] = await db
		.insert(lesson)
		.values({
			duration: 1,
			...data
		})
		.returning();

	return testLesson;
}
