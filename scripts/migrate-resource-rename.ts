/**
 * One-off, idempotent migration: rename lesson_link/lesson_file to
 * resource_link/resource_file, rename their constraints/sequences to the new
 * prefix, and add nullable course_id/module_id FK columns (ON DELETE CASCADE).
 *
 * Run once:  DATABASE_URL=... bun run scripts/migrate-resource-rename.ts
 * Safe to re-run (every statement is guarded).
 */
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
const sql = neon(url);

// Each entry is one complete SQL statement (a DO block counts as one statement).
const statements: string[] = [
	`ALTER TABLE IF EXISTS lesson_link RENAME TO resource_link`,
	`ALTER TABLE IF EXISTS lesson_file RENAME TO resource_file`,
	`ALTER SEQUENCE IF EXISTS lesson_link_id_seq RENAME TO resource_link_id_seq`,
	`ALTER SEQUENCE IF EXISTS lesson_file_id_seq RENAME TO resource_file_id_seq`,
	`DO $$ BEGIN
		IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='lesson_link_pkey') THEN
			ALTER TABLE resource_link RENAME CONSTRAINT lesson_link_pkey TO resource_link_pkey;
		END IF;
		IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='lesson_file_pkey') THEN
			ALTER TABLE resource_file RENAME CONSTRAINT lesson_file_pkey TO resource_file_pkey;
		END IF;
	END $$`,
	`DO $$ BEGIN
		IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='lesson_link_lesson_id_lesson_id_fk') THEN
			ALTER TABLE resource_link RENAME CONSTRAINT lesson_link_lesson_id_lesson_id_fk TO resource_link_lesson_id_lesson_id_fk;
		END IF;
		IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='lesson_link_scheduled_lesson_id_scheduled_lesson_id_fk') THEN
			ALTER TABLE resource_link RENAME CONSTRAINT lesson_link_scheduled_lesson_id_scheduled_lesson_id_fk TO resource_link_scheduled_lesson_id_scheduled_lesson_id_fk;
		END IF;
		IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='lesson_file_lesson_id_lesson_id_fk') THEN
			ALTER TABLE resource_file RENAME CONSTRAINT lesson_file_lesson_id_lesson_id_fk TO resource_file_lesson_id_lesson_id_fk;
		END IF;
		IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='lesson_file_scheduled_lesson_id_scheduled_lesson_id_fk') THEN
			ALTER TABLE resource_file RENAME CONSTRAINT lesson_file_scheduled_lesson_id_scheduled_lesson_id_fk TO resource_file_scheduled_lesson_id_scheduled_lesson_id_fk;
		END IF;
	END $$`,
	`ALTER TABLE resource_link ADD COLUMN IF NOT EXISTS course_id integer`,
	`ALTER TABLE resource_link ADD COLUMN IF NOT EXISTS module_id integer`,
	`ALTER TABLE resource_file ADD COLUMN IF NOT EXISTS course_id integer`,
	`ALTER TABLE resource_file ADD COLUMN IF NOT EXISTS module_id integer`,
	`DO $$ BEGIN
		IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='resource_link_course_id_course_id_fk') THEN
			ALTER TABLE resource_link ADD CONSTRAINT resource_link_course_id_course_id_fk FOREIGN KEY (course_id) REFERENCES course(id) ON DELETE CASCADE;
		END IF;
		IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='resource_link_module_id_module_id_fk') THEN
			ALTER TABLE resource_link ADD CONSTRAINT resource_link_module_id_module_id_fk FOREIGN KEY (module_id) REFERENCES module(id) ON DELETE CASCADE;
		END IF;
		IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='resource_file_course_id_course_id_fk') THEN
			ALTER TABLE resource_file ADD CONSTRAINT resource_file_course_id_course_id_fk FOREIGN KEY (course_id) REFERENCES course(id) ON DELETE CASCADE;
		END IF;
		IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='resource_file_module_id_module_id_fk') THEN
			ALTER TABLE resource_file ADD CONSTRAINT resource_file_module_id_module_id_fk FOREIGN KEY (module_id) REFERENCES module(id) ON DELETE CASCADE;
		END IF;
	END $$`
];

for (const stmt of statements) {
	await sql.query(stmt);
	console.log('ok:', stmt.split('\n')[0].slice(0, 70));
}
console.log('migration complete');
