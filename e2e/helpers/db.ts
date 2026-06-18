/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq } from 'drizzle-orm';
import * as schema from '../../src/lib/server/db/schema';

/**
 * Minimal .env parser: KEY=VALUE per line, `#` comments, optional quotes.
 * Mirrors the parser in playwright.config.ts.
 */
function loadEnv(path: string): Record<string, string> {
	if (!existsSync(path)) return {};
	const env: Record<string, string> = {};
	for (const line of readFileSync(path, 'utf8').split('\n')) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const eqIdx = trimmed.indexOf('=');
		if (eqIdx === -1) continue;
		const key = trimmed.slice(0, eqIdx).trim();
		let value = trimmed.slice(eqIdx + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		env[key] = value;
	}
	return env;
}

// Merge .env → .env.local → .env.test (later entries win).
const env: Record<string, string> = {
	...loadEnv('.env'),
	...loadEnv('.env.local'),
	...loadEnv('.env.test')
};

function resolve(key: string): string | undefined {
	return env[key] ?? process.env[key];
}

/** The CRON_SECRET from .env.test (written by db:test:setup). */
export const CRON_SECRET: string | undefined = resolve('CRON_SECRET');

/** The Vercel Blob token (from .env). */
export const BLOB_TOKEN: string | undefined = resolve('BLOB_READ_WRITE_TOKEN');

// Build the drizzle client once, eagerly (this is a helper module, not a SvelteKit server module).
const databaseUrl = resolve('DATABASE_URL') ?? resolve('DATABASE_URL_UNPOOLED');
if (!databaseUrl) {
	throw new Error(
		'Neither DATABASE_URL nor DATABASE_URL_UNPOOLED is set. ' +
			'Run `bun run db:test:setup` to create .env.test.'
	);
}

const db = drizzle(neon(databaseUrl), { schema });

// ── Query helpers ─────────────────────────────────────────────────────────────

/**
 * Return the userId and numeric id of the class with the given name.
 * Throws if no matching row exists.
 */
export async function getClassByName(name: string): Promise<{ userId: string; classId: number }> {
	const [row] = await db
		.select({ userId: schema.klass.userId, classId: schema.klass.id })
		.from(schema.klass)
		.where(eq(schema.klass.name, name));
	if (!row) throw new Error(`No class found with name "${name}"`);
	return row;
}

/**
 * Insert a scheduled lesson and return its generated id.
 */
export async function insertScheduledLesson(opts: {
	userId: string;
	classId: number;
	title: string;
	date: string;
}): Promise<number> {
	const [row] = await db
		.insert(schema.scheduledLesson)
		.values({
			userId: opts.userId,
			classId: opts.classId,
			title: opts.title,
			date: opts.date,
			orderIndex: 0
		})
		.returning({ id: schema.scheduledLesson.id });
	return row.id;
}

/**
 * Attach a blob-backed resource file to a scheduled lesson.
 */
export async function insertResourceFile(opts: {
	userId: string;
	scheduledLessonId: number;
	blobUrl: string;
	pathname: string;
}): Promise<void> {
	await db.insert(schema.resourceFile).values({
		userId: opts.userId,
		scheduledLessonId: opts.scheduledLessonId,
		blobUrl: opts.blobUrl,
		pathname: opts.pathname,
		filename: 'aged.pdf',
		contentType: 'application/pdf',
		size: 24
	});
}

/**
 * Return true if a scheduled_lesson row with the given id still exists.
 */
export async function scheduledLessonExists(id: number): Promise<boolean> {
	const [row] = await db
		.select({ id: schema.scheduledLesson.id })
		.from(schema.scheduledLesson)
		.where(eq(schema.scheduledLesson.id, id));
	return row !== undefined;
}
