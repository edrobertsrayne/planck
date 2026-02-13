import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const client = new Database(env.DATABASE_URL);

// Enable foreign key constraints
client.run('PRAGMA foreign_keys = ON');

// For in-memory test databases, create the schema
if (env.DATABASE_URL === ':memory:') {
	const statements = [
		`CREATE TABLE IF NOT EXISTS exam_spec (
			id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
			board TEXT NOT NULL,
			level TEXT NOT NULL,
			name TEXT NOT NULL,
			spec_code TEXT,
			spec_year TEXT,
			created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
			updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS topic (
			id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
			exam_spec_id TEXT NOT NULL REFERENCES exam_spec(id) ON DELETE CASCADE,
			name TEXT NOT NULL,
			code TEXT,
			sort_order INTEGER NOT NULL,
			created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
			updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS spec_point (
			id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
			topic_id TEXT NOT NULL REFERENCES topic(id) ON DELETE CASCADE,
			reference TEXT NOT NULL,
			content TEXT NOT NULL,
			sort_order INTEGER NOT NULL,
			created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
			updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS teaching_class (
			id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
			name TEXT NOT NULL,
			year_group INTEGER NOT NULL,
			exam_spec_id TEXT NOT NULL REFERENCES exam_spec(id),
			academic_year TEXT NOT NULL,
			student_count INTEGER,
			created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
			updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS module (
			id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
			name TEXT NOT NULL,
			description TEXT,
			target_spec_id TEXT REFERENCES exam_spec(id),
			created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
			updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS lesson (
			id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
			module_id TEXT NOT NULL REFERENCES module(id) ON DELETE CASCADE,
			title TEXT NOT NULL,
			content TEXT,
			duration INTEGER NOT NULL DEFAULT 1,
			"order" INTEGER NOT NULL,
			created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
			updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS lesson_spec_point (
			id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
			lesson_id TEXT NOT NULL REFERENCES lesson(id) ON DELETE CASCADE,
			spec_point_id TEXT NOT NULL REFERENCES spec_point(id) ON DELETE CASCADE,
			created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
			UNIQUE(lesson_id, spec_point_id)
		)`,
		`CREATE TABLE IF NOT EXISTS timetable_config (
			id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
			academic_year TEXT NOT NULL UNIQUE,
			weeks INTEGER NOT NULL DEFAULT 1,
			periods_per_day INTEGER NOT NULL,
			days_per_week INTEGER NOT NULL DEFAULT 5,
			created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
			updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS timetable_slot (
			id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
			class_id TEXT NOT NULL REFERENCES teaching_class(id) ON DELETE CASCADE,
			day INTEGER NOT NULL,
			period_start INTEGER NOT NULL,
			period_end INTEGER NOT NULL,
			week TEXT CHECK(week IN ('A', 'B')),
			created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
			updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS module_assignment (
			id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
			class_id TEXT NOT NULL REFERENCES teaching_class(id) ON DELETE CASCADE,
			module_id TEXT NOT NULL REFERENCES module(id),
			start_date INTEGER NOT NULL,
			created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
			updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS scheduled_lesson (
			id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
			assignment_id TEXT NOT NULL REFERENCES module_assignment(id) ON DELETE CASCADE,
			lesson_id TEXT NOT NULL REFERENCES lesson(id),
			calendar_date INTEGER NOT NULL,
			timetable_slot_id TEXT REFERENCES timetable_slot(id),
			title TEXT NOT NULL,
			content TEXT,
			duration INTEGER NOT NULL,
			"order" INTEGER NOT NULL,
			created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
			updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS scheduled_lesson_spec_point (
			id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
			scheduled_lesson_id TEXT NOT NULL REFERENCES scheduled_lesson(id) ON DELETE CASCADE,
			spec_point_id TEXT NOT NULL REFERENCES spec_point(id) ON DELETE CASCADE,
			created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
			UNIQUE(scheduled_lesson_id, spec_point_id)
		)`,
		`CREATE TABLE IF NOT EXISTS calendar_event (
			id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
			class_id TEXT REFERENCES teaching_class(id) ON DELETE CASCADE,
			academic_year TEXT NOT NULL,
			event_type TEXT NOT NULL,
			title TEXT NOT NULL,
			description TEXT,
			start_date INTEGER NOT NULL,
			end_date INTEGER NOT NULL,
			affects_scheduling INTEGER NOT NULL DEFAULT 1,
			created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
			updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
		)`
	];

	for (const stmt of statements) {
		client.run(stmt);
	}
}

export const db = drizzle({ client, schema });
