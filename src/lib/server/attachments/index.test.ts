import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	createFileAttachment,
	createLinkAttachment,
	getAttachments,
	getAttachment,
	deleteAttachment,
	validateFileType,
	validateFileSize,
	saveFile
} from './index';
import { db } from '$lib/server/db';
import { attachment, examSpec } from '$lib/server/db/schema';
import { existsSync } from 'fs';
import { unlink } from 'fs/promises';
import { join } from 'path';

const UPLOADS_DIR = process.env.UPLOADS_DIR || 'uploads';

describe('Attachment Utilities', () => {
	let testSpec: { id: string };
	let createdFiles: string[] = [];

	beforeEach(async () => {
		// Clean up test data
		await db.delete(attachment);
		await db.delete(examSpec);

		// Create test exam spec
		const specs = await db
			.insert(examSpec)
			.values({
				board: 'AQA',
				level: 'GCSE',
				name: 'AQA GCSE Physics (8463)',
				specCode: '8463',
				specYear: '2018'
			})
			.returning();
		testSpec = specs[0];

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

	describe('validateFileType', () => {
		it('should accept PDF files', () => {
			expect(validateFileType('application/pdf')).toBe(true);
		});

		it('should accept DOCX files', () => {
			expect(
				validateFileType('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
			).toBe(true);
		});

		it('should accept PPTX files', () => {
			expect(
				validateFileType(
					'application/vnd.openxmlformats-officedocument.presentationml.presentation'
				)
			).toBe(true);
		});

		it('should accept image files', () => {
			expect(validateFileType('image/jpeg')).toBe(true);
			expect(validateFileType('image/png')).toBe(true);
			expect(validateFileType('image/gif')).toBe(true);
			expect(validateFileType('image/webp')).toBe(true);
		});

		it('should reject unsupported file types', () => {
			expect(validateFileType('application/zip')).toBe(false);
			expect(validateFileType('text/plain')).toBe(false);
			expect(validateFileType('video/mp4')).toBe(false);
		});
	});

	describe('validateFileSize', () => {
		it('should accept files under 10MB', () => {
			expect(validateFileSize(5 * 1024 * 1024)).toBe(true); // 5MB
			expect(validateFileSize(1024)).toBe(true); // 1KB
		});

		it('should reject files over 10MB', () => {
			expect(validateFileSize(11 * 1024 * 1024)).toBe(false); // 11MB
			expect(validateFileSize(50 * 1024 * 1024)).toBe(false); // 50MB
		});
	});

	describe('saveFile', () => {
		it('should save a valid file', async () => {
			const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
			const fileName = await saveFile(file);

			createdFiles.push(fileName);

			expect(fileName).toBeTruthy();
			expect(existsSync(join(UPLOADS_DIR, fileName))).toBe(true);
		});

		it('should reject files with invalid MIME type', async () => {
			const file = new File(['test content'], 'test.zip', { type: 'application/zip' });

			await expect(saveFile(file)).rejects.toThrow('Invalid file type');
		});

		it('should reject files that are too large', async () => {
			const largeContent = new Uint8Array(11 * 1024 * 1024); // 11MB
			const file = new File([largeContent], 'large.pdf', { type: 'application/pdf' });

			await expect(saveFile(file)).rejects.toThrow('File too large');
		});
	});

	describe('createFileAttachment', () => {
		it('should create a file attachment record', async () => {
			const file = new File(['test content'], 'test-document.pdf', {
				type: 'application/pdf'
			});
			const newAttachment = await createFileAttachment('spec', testSpec.id, file);

			if (newAttachment.filePath) {
				createdFiles.push(newAttachment.filePath);
			}

			expect(newAttachment).toBeTruthy();
			expect(newAttachment.type).toBe('file');
			expect(newAttachment.entityType).toBe('spec');
			expect(newAttachment.entityId).toBe(testSpec.id);
			expect(newAttachment.fileName).toBe('test-document.pdf');
			expect(newAttachment.mimeType).toBe('application/pdf');
			expect(newAttachment.filePath).toBeTruthy();
		});
	});

	describe('createLinkAttachment', () => {
		it('should create a link attachment record', async () => {
			const url = 'https://example.com/document.pdf';
			const title = 'Example Document';
			const newAttachment = await createLinkAttachment('spec', testSpec.id, url, title);

			expect(newAttachment).toBeTruthy();
			expect(newAttachment.type).toBe('link');
			expect(newAttachment.entityType).toBe('spec');
			expect(newAttachment.entityId).toBe(testSpec.id);
			expect(newAttachment.url).toBe(url);
			expect(newAttachment.fileName).toBe(title);
		});
	});

	describe('getAttachments', () => {
		it('should return all attachments for an entity', async () => {
			// Create multiple attachments
			await createLinkAttachment('spec', testSpec.id, 'https://example.com/1', 'Link 1');
			await createLinkAttachment('spec', testSpec.id, 'https://example.com/2', 'Link 2');

			const attachments = await getAttachments('spec', testSpec.id);

			expect(attachments).toHaveLength(2);
			expect(attachments[0].entityType).toBe('spec');
			expect(attachments[0].entityId).toBe(testSpec.id);
		});

		it('should return empty array for entity with no attachments', async () => {
			const attachments = await getAttachments('spec', testSpec.id);

			expect(attachments).toHaveLength(0);
		});
	});

	describe('getAttachment', () => {
		it('should return a specific attachment by ID', async () => {
			const created = await createLinkAttachment(
				'spec',
				testSpec.id,
				'https://example.com/doc',
				'Test Doc'
			);

			const fetched = await getAttachment(created.id);

			expect(fetched).toBeTruthy();
			expect(fetched?.id).toBe(created.id);
			expect(fetched?.url).toBe('https://example.com/doc');
		});

		it('should return undefined for non-existent attachment', async () => {
			const fetched = await getAttachment('non-existent-id');

			expect(fetched).toBeUndefined();
		});
	});

	describe('deleteAttachment', () => {
		it('should delete a link attachment', async () => {
			const created = await createLinkAttachment(
				'spec',
				testSpec.id,
				'https://example.com/doc',
				'Test Doc'
			);

			await deleteAttachment(created.id);

			const fetched = await getAttachment(created.id);
			expect(fetched).toBeUndefined();
		});

		it('should delete a file attachment and the associated file', async () => {
			const file = new File(['test content'], 'to-delete.pdf', {
				type: 'application/pdf'
			});
			const created = await createFileAttachment('spec', testSpec.id, file);

			expect(existsSync(join(UPLOADS_DIR, created.filePath!))).toBe(true);

			await deleteAttachment(created.id);

			const fetched = await getAttachment(created.id);
			expect(fetched).toBeUndefined();
			expect(existsSync(join(UPLOADS_DIR, created.filePath!))).toBe(false);
		});

		it('should not throw error when deleting non-existent attachment', async () => {
			await expect(deleteAttachment('non-existent-id')).resolves.not.toThrow();
		});
	});
});
