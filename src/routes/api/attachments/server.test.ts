/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck - Test file with mock types for SvelteKit API endpoints
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GET, POST, DELETE } from './+server.js';
import { db } from '$lib/server/db';
import {
	attachment,
	course,
	teachingClass,
	module,
	scheduledLesson,
	moduleAssignment,
	lesson
} from '$lib/server/db/schema';
import { existsSync } from 'fs';
import { unlink } from 'fs/promises';
import { join } from 'path';

const UPLOADS_DIR = process.env.UPLOADS_DIR || 'uploads';

describe('Attachments API Endpoints', () => {
	let testCourse: { id: string };
	let createdFiles: string[] = [];

	beforeEach(async () => {
		// Clean up test data in foreign key dependency order
		await db.delete(attachment);
		await db.delete(scheduledLesson);
		await db.delete(moduleAssignment);
		await db.delete(lesson);
		await db.delete(module);
		await db.delete(teachingClass);
		await db.delete(course);

		const courses = await db.insert(course).values({ name: 'GCSE Physics' }).returning();
		testCourse = courses[0];

		createdFiles = [];
	});

	afterEach(async () => {
		// Clean up any files created during tests
		for (const fileName of createdFiles) {
			try {
				await unlink(join(UPLOADS_DIR, fileName));
			} catch {
				// Ignore errors if file doesn't exist
			}
		}
	});

	describe('GET endpoint', () => {
		it('should return attachments for an entity', async () => {
			// Create test attachments
			await db.insert(attachment).values([
				{
					type: 'link',
					entityType: 'course',
					entityId: testCourse.id,
					url: 'https://example.com/doc1',
					fileName: 'Document 1'
				},
				{
					type: 'link',
					entityType: 'course',
					entityId: testCourse.id,
					url: 'https://example.com/doc2',
					fileName: 'Document 2'
				}
			]);

			const response = await GET({
				url: new URL(`http://localhost/api/attachments?entityType=course&entityId=${testCourse.id}`)
			});

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data).toHaveLength(2);
			expect(data[0].fileName).toBe('Document 1');
			expect(data[1].fileName).toBe('Document 2');
		});

		it('should return 400 if entityType is missing', async () => {
			try {
				await GET({
					url: new URL(`http://localhost/api/attachments?entityId=${testCourse.id}`)
				});
				expect.fail('Should have thrown error');
			} catch (error) {
				expect(error.status).toBe(400);
			}
		});

		it('should return 400 if entityId is missing', async () => {
			try {
				await GET({
					url: new URL('http://localhost/api/attachments?entityType=course')
				});
				expect.fail('Should have thrown error');
			} catch (error) {
				expect(error.status).toBe(400);
			}
		});
	});

	describe('POST endpoint', () => {
		it('should create a link attachment', async () => {
			const formData = new FormData();
			formData.append('entityType', 'course');
			formData.append('entityId', testCourse.id);
			formData.append('type', 'link');
			formData.append('url', 'https://example.com/document');
			formData.append('title', 'Test Document');

			const response = await POST({
				request: {
					formData: async () => formData
				}
			});

			expect(response.status).toBe(201);
			const data = await response.json();
			expect(data.type).toBe('link');
			expect(data.url).toBe('https://example.com/document');
			expect(data.fileName).toBe('Test Document');
		});

		it('should create a file attachment', async () => {
			const formData = new FormData();
			formData.append('entityType', 'course');
			formData.append('entityId', testCourse.id);
			formData.append('type', 'file');

			const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
			formData.append('file', file);

			const response = await POST({
				request: {
					formData: async () => formData
				}
			});

			expect(response.status).toBe(201);
			const data = await response.json();
			expect(data.type).toBe('file');
			expect(data.fileName).toBe('test.pdf');
			expect(data.filePath).toBeTruthy();

			// Track for cleanup
			if (data.filePath) {
				createdFiles.push(data.filePath);
			}

			// Verify file exists
			expect(existsSync(join(UPLOADS_DIR, data.filePath))).toBe(true);
		});

		it('should return 400 if type is missing', async () => {
			const formData = new FormData();
			formData.append('entityType', 'course');
			formData.append('entityId', testCourse.id);

			try {
				await POST({
					request: {
						formData: async () => formData
					}
				});
				expect.fail('Should have thrown error');
			} catch (error) {
				expect(error.status).toBe(400);
			}
		});

		it('should return 400 if file is missing for file attachment', async () => {
			const formData = new FormData();
			formData.append('entityType', 'course');
			formData.append('entityId', testCourse.id);
			formData.append('type', 'file');

			try {
				await POST({
					request: {
						formData: async () => formData
					}
				});
				expect.fail('Should have thrown error');
			} catch (error) {
				expect(error.status).toBe(400);
			}
		});

		it('should return 400 if url is missing for link attachment', async () => {
			const formData = new FormData();
			formData.append('entityType', 'course');
			formData.append('entityId', testCourse.id);
			formData.append('type', 'link');
			formData.append('title', 'Test');

			try {
				await POST({
					request: {
						formData: async () => formData
					}
				});
				expect.fail('Should have thrown error');
			} catch (error) {
				expect(error.status).toBe(400);
			}
		});
	});

	describe('DELETE endpoint', () => {
		it('should delete an attachment', async () => {
			// Create test attachment
			const [created] = await db
				.insert(attachment)
				.values({
					type: 'link',
					entityType: 'course',
					entityId: testCourse.id,
					url: 'https://example.com/doc',
					fileName: 'Test Doc'
				})
				.returning();

			const response = await DELETE({
				url: new URL(`http://localhost/api/attachments?id=${created.id}`)
			});

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data.success).toBe(true);

			// Verify attachment was deleted
			const attachments = await db.select().from(attachment);
			expect(attachments).toHaveLength(0);
		});

		it('should return 400 if id is missing', async () => {
			try {
				await DELETE({
					url: new URL('http://localhost/api/attachments')
				});
				expect.fail('Should have thrown error');
			} catch (error) {
				expect(error.status).toBe(400);
			}
		});
	});
});
