import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

// Safety guard: tests must never run against the dev database
if (process.env.VITEST && env.DATABASE_URL !== ':memory:') {
	throw new Error(
		`Tests must use DATABASE_URL=:memory: to protect dev data, but got: "${env.DATABASE_URL}". ` +
			`Check .env.test and vite.config.ts server project env config.`
	);
}

// Convert DATABASE_URL to libsql format (file: prefix for local files)
const url =
	env.DATABASE_URL === ':memory:'
		? ':memory:'
		: env.DATABASE_URL.startsWith('file:')
			? env.DATABASE_URL
			: `file:${env.DATABASE_URL}`;

const client = createClient({ url });

// Enable foreign key constraints
await client.execute('PRAGMA foreign_keys = ON');

// For in-memory test databases, create the schema
if (env.DATABASE_URL === ':memory:') {
	const statements = [
		`CREATE TABLE IF NOT EXISTS "exam_spec" (
			"id" TEXT PRIMARY KEY NOT NULL,
			"board" TEXT NOT NULL,
			"level" TEXT NOT NULL,
			"name" TEXT NOT NULL,
			"spec_code" TEXT,
			"spec_year" TEXT,
			"created_at" INTEGER NOT NULL,
			"updated_at" INTEGER NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS "topic" (
			"id" TEXT PRIMARY KEY NOT NULL,
			"exam_spec_id" TEXT NOT NULL REFERENCES "exam_spec"("id") ON DELETE CASCADE,
			"parent_id" TEXT REFERENCES "topic"("id") ON DELETE CASCADE,
			"name" TEXT NOT NULL,
			"code" TEXT,
			"description" TEXT,
			"sort_order" INTEGER DEFAULT 0 NOT NULL,
			"created_at" INTEGER NOT NULL,
			"updated_at" INTEGER NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS "spec_point" (
			"id" TEXT PRIMARY KEY NOT NULL,
			"topic_id" TEXT NOT NULL REFERENCES "topic"("id") ON DELETE CASCADE,
			"reference" TEXT NOT NULL,
			"content" TEXT NOT NULL,
			"notes" TEXT,
			"tier" TEXT DEFAULT 'both',
			"sort_order" INTEGER DEFAULT 0 NOT NULL,
			"created_at" INTEGER NOT NULL,
			"updated_at" INTEGER NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS "class" (
			"id" TEXT PRIMARY KEY NOT NULL,
			"name" TEXT NOT NULL,
			"year_group" INTEGER NOT NULL,
			"exam_spec_id" TEXT NOT NULL REFERENCES "exam_spec"("id") ON DELETE RESTRICT,
			"academic_year" TEXT NOT NULL,
			"student_count" INTEGER,
			"room" TEXT,
			"notes" TEXT,
			"created_at" INTEGER NOT NULL,
			"updated_at" INTEGER NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS "module" (
			"id" TEXT PRIMARY KEY NOT NULL,
			"name" TEXT NOT NULL,
			"description" TEXT,
			"target_spec_id" TEXT REFERENCES "exam_spec"("id") ON DELETE SET NULL,
			"created_at" INTEGER NOT NULL,
			"updated_at" INTEGER NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS "lesson" (
			"id" TEXT PRIMARY KEY NOT NULL,
			"module_id" TEXT NOT NULL REFERENCES "module"("id") ON DELETE CASCADE,
			"title" TEXT NOT NULL,
			"content" TEXT,
			"duration" INTEGER DEFAULT 1 NOT NULL,
			"order" INTEGER NOT NULL,
			"created_at" INTEGER NOT NULL,
			"updated_at" INTEGER NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS "lesson_spec_point" (
			"id" TEXT PRIMARY KEY NOT NULL,
			"lesson_id" TEXT NOT NULL REFERENCES "lesson"("id") ON DELETE CASCADE,
			"spec_point_id" TEXT NOT NULL REFERENCES "spec_point"("id") ON DELETE CASCADE,
			"created_at" INTEGER NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS "timetable_config" (
			"id" TEXT PRIMARY KEY NOT NULL,
			"academic_year" TEXT NOT NULL,
			"weeks" INTEGER DEFAULT 1 NOT NULL,
			"periods_per_day" INTEGER DEFAULT 6 NOT NULL,
			"days_per_week" INTEGER DEFAULT 5 NOT NULL,
			"created_at" INTEGER NOT NULL,
			"updated_at" INTEGER NOT NULL
		)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS "timetable_config_academic_year_unique" ON "timetable_config" ("academic_year")`,
		`CREATE TABLE IF NOT EXISTS "timetable_slot" (
			"id" TEXT PRIMARY KEY NOT NULL,
			"class_id" TEXT NOT NULL REFERENCES "class"("id") ON DELETE CASCADE,
			"day" INTEGER NOT NULL,
			"period_start" INTEGER NOT NULL,
			"period_end" INTEGER NOT NULL,
			"week" TEXT,
			"created_at" INTEGER NOT NULL,
			"updated_at" INTEGER NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS "module_assignment" (
			"id" TEXT PRIMARY KEY NOT NULL,
			"class_id" TEXT NOT NULL REFERENCES "class"("id") ON DELETE CASCADE,
			"module_id" TEXT NOT NULL REFERENCES "module"("id") ON DELETE RESTRICT,
			"start_date" INTEGER NOT NULL,
			"created_at" INTEGER NOT NULL,
			"updated_at" INTEGER NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS "scheduled_lesson" (
			"id" TEXT PRIMARY KEY NOT NULL,
			"assignment_id" TEXT NOT NULL REFERENCES "module_assignment"("id") ON DELETE CASCADE,
			"lesson_id" TEXT NOT NULL REFERENCES "lesson"("id") ON DELETE RESTRICT,
			"calendar_date" INTEGER NOT NULL,
			"timetable_slot_id" TEXT REFERENCES "timetable_slot"("id") ON DELETE SET NULL,
			"title" TEXT NOT NULL,
			"content" TEXT,
			"duration" INTEGER DEFAULT 1 NOT NULL,
			"order" INTEGER NOT NULL,
			"created_at" INTEGER NOT NULL,
			"updated_at" INTEGER NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS "scheduled_lesson_spec_point" (
			"id" TEXT PRIMARY KEY NOT NULL,
			"scheduled_lesson_id" TEXT NOT NULL REFERENCES "scheduled_lesson"("id") ON DELETE CASCADE,
			"spec_point_id" TEXT NOT NULL REFERENCES "spec_point"("id") ON DELETE CASCADE,
			"created_at" INTEGER NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS "calendar_event" (
			"id" TEXT PRIMARY KEY NOT NULL,
			"type" TEXT NOT NULL,
			"title" TEXT NOT NULL,
			"start_date" INTEGER NOT NULL,
			"end_date" INTEGER NOT NULL,
			"affects_all_classes" INTEGER DEFAULT 1 NOT NULL,
			"created_at" INTEGER NOT NULL,
			"updated_at" INTEGER NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS "attachment" (
			"id" TEXT PRIMARY KEY NOT NULL,
			"type" TEXT NOT NULL,
			"entity_type" TEXT NOT NULL,
			"entity_id" TEXT NOT NULL,
			"file_path" TEXT,
			"url" TEXT,
			"file_name" TEXT,
			"mime_type" TEXT,
			"created_at" INTEGER NOT NULL,
			"updated_at" INTEGER NOT NULL
		)`
	];

	for (const stmt of statements) {
		await client.execute(stmt);
	}
}

export const db = drizzle({ client, schema });
