import { db } from '../db';
import { attachment } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

/**
 * Entity types that can have attachments
 */
export type AttachmentEntityType = 'class' | 'module' | 'lesson' | 'scheduledLesson' | 'course';

/**
 * Attachment type: file or link
 */
export type AttachmentType = 'file' | 'link';

/**
 * Configuration for uploads directory
 */
const UPLOADS_DIR = process.env.UPLOADS_DIR || 'uploads';

/**
 * Allowed file MIME types
 */
const ALLOWED_MIME_TYPES = [
	'application/pdf',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
	'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
	'image/jpeg',
	'image/png',
	'image/gif',
	'image/webp'
];

/**
 * Maximum file size in bytes (10MB)
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Ensure uploads directory exists
 */
async function ensureUploadsDir() {
	if (!existsSync(UPLOADS_DIR)) {
		await mkdir(UPLOADS_DIR, { recursive: true });
	}
}

/**
 * Generate a unique file name to avoid collisions
 */
function generateFileName(originalName: string): string {
	const timestamp = Date.now();
	const randomStr = crypto.randomUUID().substring(0, 8);
	const ext = originalName.substring(originalName.lastIndexOf('.'));
	const baseName = originalName
		.substring(0, originalName.lastIndexOf('.'))
		.replace(/[^a-zA-Z0-9]/g, '_');
	return `${baseName}_${timestamp}_${randomStr}${ext}`;
}

/**
 * Validate file type
 */
export function validateFileType(mimeType: string): boolean {
	return ALLOWED_MIME_TYPES.includes(mimeType);
}

/**
 * Validate file size
 */
export function validateFileSize(size: number): boolean {
	return size <= MAX_FILE_SIZE;
}

/**
 * Save an uploaded file
 */
export async function saveFile(file: File): Promise<string> {
	// Validate file type
	if (!validateFileType(file.type)) {
		throw new Error(`Invalid file type: ${file.type}. Allowed types: PDF, DOCX, PPTX, images`);
	}

	// Validate file size
	if (!validateFileSize(file.size)) {
		throw new Error(`File too large: ${file.size} bytes. Maximum allowed: ${MAX_FILE_SIZE} bytes`);
	}

	// Ensure uploads directory exists
	await ensureUploadsDir();

	// Generate unique file name
	const fileName = generateFileName(file.name);
	const filePath = join(UPLOADS_DIR, fileName);

	// Write file to disk
	const buffer = Buffer.from(await file.arrayBuffer());
	await writeFile(filePath, buffer);

	return fileName; // Return relative path (just the filename)
}

/**
 * Delete a file from disk
 */
export async function deleteFile(fileName: string): Promise<void> {
	const filePath = join(UPLOADS_DIR, fileName);
	try {
		await unlink(filePath);
	} catch (error) {
		// Ignore errors if file doesn't exist
		console.warn(`Failed to delete file: ${filePath}`, error);
	}
}

/**
 * Get the full file path for serving
 */
export function getFilePath(fileName: string): string {
	return join(UPLOADS_DIR, fileName);
}

/**
 * Create a file attachment record
 */
export async function createFileAttachment(
	entityType: AttachmentEntityType,
	entityId: string,
	file: File
): Promise<typeof attachment.$inferSelect> {
	const fileName = await saveFile(file);

	const [newAttachment] = await db
		.insert(attachment)
		.values({
			type: 'file',
			entityType,
			entityId,
			filePath: fileName,
			fileName: file.name,
			mimeType: file.type
		})
		.returning();

	return newAttachment;
}

/**
 * Create a link attachment record
 */
export async function createLinkAttachment(
	entityType: AttachmentEntityType,
	entityId: string,
	url: string,
	title: string
): Promise<typeof attachment.$inferSelect> {
	const [newAttachment] = await db
		.insert(attachment)
		.values({
			type: 'link',
			entityType,
			entityId,
			url,
			fileName: title
		})
		.returning();

	return newAttachment;
}

/**
 * Get all attachments for an entity
 */
export async function getAttachments(
	entityType: AttachmentEntityType,
	entityId: string
): Promise<Array<typeof attachment.$inferSelect>> {
	return db
		.select()
		.from(attachment)
		.where(and(eq(attachment.entityType, entityType), eq(attachment.entityId, entityId)));
}

/**
 * Get a single attachment by ID
 */
export async function getAttachment(
	id: string
): Promise<typeof attachment.$inferSelect | undefined> {
	const results = await db.select().from(attachment).where(eq(attachment.id, id));
	return results[0];
}

/**
 * Delete an attachment (and associated file if it's a file attachment)
 */
export async function deleteAttachment(id: string): Promise<void> {
	// Get the attachment first to check if it's a file
	const att = await getAttachment(id);
	if (!att) {
		return;
	}

	// If it's a file attachment, delete the file from disk
	if (att.type === 'file' && att.filePath) {
		await deleteFile(att.filePath);
	}

	// Delete the database record
	await db.delete(attachment).where(eq(attachment.id, id));
}
