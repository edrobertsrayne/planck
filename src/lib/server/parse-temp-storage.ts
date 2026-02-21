import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

// Configuration
const TEMP_DIR = process.env.PARSE_TEMP_DIR || '/tmp/planck-parse';
const EXPIRY_HOURS = 1;
const MAX_STORAGE_MB = 100;

// Metadata structure
export interface ParseMetadata {
	uploadId: string;
	fileName: string;
	fileSize: number;
	inputType: 'file' | 'url';
	inputSource?: string;
	createdAt: Date;
	expiresAt: Date;
	steps: {
		uploaded: boolean;
		extracted: boolean;
		parsed: boolean;
	};
	textLength?: number;
	errorMessage?: string;
}

// Validate uploadId is a valid UUID (prevent path traversal)
function isValidUploadId(uploadId: string): boolean {
	const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
	return uuidRegex.test(uploadId);
}

// Get paths for a session
function getSessionPaths(uploadId: string) {
	const sessionDir = path.join(TEMP_DIR, uploadId);
	return {
		sessionDir,
		metadata: path.join(sessionDir, 'metadata.json'),
		pdf: path.join(sessionDir, 'original.pdf'),
		text: path.join(sessionDir, 'extracted.txt')
	};
}

// Check total storage size
async function checkStorageLimit(): Promise<void> {
	if (!existsSync(TEMP_DIR)) return;

	const dirs = await fs.readdir(TEMP_DIR);
	let totalSize = 0;

	for (const dir of dirs) {
		const sessionDir = path.join(TEMP_DIR, dir);
		try {
			const stats = await fs.stat(sessionDir);
			if (stats.isDirectory()) {
				const files = await fs.readdir(sessionDir);
				for (const file of files) {
					const filePath = path.join(sessionDir, file);
					const fileStats = await fs.stat(filePath);
					totalSize += fileStats.size;
				}
			}
		} catch {
			// Ignore errors for individual sessions
		}
	}

	const totalMB = totalSize / (1024 * 1024);
	if (totalMB > MAX_STORAGE_MB) {
		throw new Error(
			`Storage limit exceeded: ${totalMB.toFixed(2)}MB / ${MAX_STORAGE_MB}MB. Please try again later.`
		);
	}
}

/**
 * Create a new parse session
 * @returns uploadId (UUID)
 */
export async function createParseSession(
	fileName: string,
	fileSize: number,
	inputType: 'file' | 'url',
	inputSource?: string
): Promise<string> {
	// Check storage limit
	await checkStorageLimit();

	// Generate UUID
	const uploadId = crypto.randomUUID();

	// Create session directory
	const paths = getSessionPaths(uploadId);
	await fs.mkdir(paths.sessionDir, { recursive: true });

	// Create metadata
	const now = new Date();
	const expiresAt = new Date(now.getTime() + EXPIRY_HOURS * 60 * 60 * 1000);

	const metadata: ParseMetadata = {
		uploadId,
		fileName,
		fileSize,
		inputType,
		inputSource,
		createdAt: now,
		expiresAt,
		steps: {
			uploaded: false,
			extracted: false,
			parsed: false
		}
	};

	// Save metadata
	await fs.writeFile(paths.metadata, JSON.stringify(metadata, null, 2));

	return uploadId;
}

/**
 * Validate that a session exists and hasn't expired
 */
export async function validateSession(uploadId: string): Promise<boolean> {
	if (!isValidUploadId(uploadId)) {
		return false;
	}

	const paths = getSessionPaths(uploadId);

	// Check if session directory exists
	if (!existsSync(paths.sessionDir)) {
		return false;
	}

	// Check if metadata exists
	if (!existsSync(paths.metadata)) {
		return false;
	}

	// Check expiry
	try {
		const metadata = await getMetadata(uploadId);
		const now = new Date();
		return now < new Date(metadata.expiresAt);
	} catch {
		return false;
	}
}

/**
 * Get session metadata
 */
export async function getMetadata(uploadId: string): Promise<ParseMetadata> {
	if (!isValidUploadId(uploadId)) {
		throw new Error('Invalid uploadId');
	}

	const paths = getSessionPaths(uploadId);
	const data = await fs.readFile(paths.metadata, 'utf-8');
	const metadata = JSON.parse(data) as ParseMetadata;

	// Convert date strings back to Date objects
	metadata.createdAt = new Date(metadata.createdAt);
	metadata.expiresAt = new Date(metadata.expiresAt);

	return metadata;
}

/**
 * Update session metadata
 */
export async function updateMetadata(
	uploadId: string,
	updates: Partial<ParseMetadata>
): Promise<void> {
	if (!isValidUploadId(uploadId)) {
		throw new Error('Invalid uploadId');
	}

	const metadata = await getMetadata(uploadId);
	const updated = { ...metadata, ...updates };

	const paths = getSessionPaths(uploadId);
	await fs.writeFile(paths.metadata, JSON.stringify(updated, null, 2));
}

/**
 * Save PDF to temp storage
 */
export async function savePdfToTemp(uploadId: string, buffer: Buffer): Promise<void> {
	if (!isValidUploadId(uploadId)) {
		throw new Error('Invalid uploadId');
	}

	const paths = getSessionPaths(uploadId);
	await fs.writeFile(paths.pdf, buffer);
}

/**
 * Read PDF from temp storage
 */
export async function readPdfFromTemp(uploadId: string): Promise<Buffer> {
	if (!isValidUploadId(uploadId)) {
		throw new Error('Invalid uploadId');
	}

	const paths = getSessionPaths(uploadId);
	return await fs.readFile(paths.pdf);
}

/**
 * Save extracted text to temp storage
 */
export async function saveExtractedText(uploadId: string, text: string): Promise<void> {
	if (!isValidUploadId(uploadId)) {
		throw new Error('Invalid uploadId');
	}

	const paths = getSessionPaths(uploadId);
	await fs.writeFile(paths.text, text, 'utf-8');
}

/**
 * Read extracted text from temp storage
 */
export async function readExtractedText(uploadId: string): Promise<string> {
	if (!isValidUploadId(uploadId)) {
		throw new Error('Invalid uploadId');
	}

	const paths = getSessionPaths(uploadId);
	return await fs.readFile(paths.text, 'utf-8');
}

/**
 * Clean up a single session
 */
export async function cleanupSession(uploadId: string): Promise<void> {
	if (!isValidUploadId(uploadId)) {
		return; // Silent fail for invalid IDs
	}

	const paths = getSessionPaths(uploadId);

	if (existsSync(paths.sessionDir)) {
		await fs.rm(paths.sessionDir, { recursive: true, force: true });
	}
}

/**
 * Clean up all expired sessions
 * @returns Number of sessions cleaned up
 */
export async function cleanupExpiredSessions(): Promise<number> {
	if (!existsSync(TEMP_DIR)) {
		return 0;
	}

	const dirs = await fs.readdir(TEMP_DIR);
	let cleanedCount = 0;
	const now = new Date();

	for (const dir of dirs) {
		const sessionDir = path.join(TEMP_DIR, dir);

		try {
			// Check if it's a directory
			const stats = await fs.stat(sessionDir);
			if (!stats.isDirectory()) continue;

			// Try to read metadata
			const metadataPath = path.join(sessionDir, 'metadata.json');
			if (!existsSync(metadataPath)) {
				// Orphaned directory without metadata - clean it up
				await fs.rm(sessionDir, { recursive: true, force: true });
				cleanedCount++;
				continue;
			}

			const data = await fs.readFile(metadataPath, 'utf-8');
			const metadata = JSON.parse(data) as ParseMetadata;
			const expiresAt = new Date(metadata.expiresAt);

			if (now > expiresAt) {
				await fs.rm(sessionDir, { recursive: true, force: true });
				cleanedCount++;
			}
		} catch (err) {
			// If we can't read metadata or encounter any error, skip this session
			console.error(`Error cleaning session ${dir}:`, err);
		}
	}

	return cleanedCount;
}
