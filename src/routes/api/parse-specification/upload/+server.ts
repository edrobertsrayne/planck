import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	createParseSession,
	savePdfToTemp,
	updateMetadata,
	getMetadata
} from '$lib/server/parse-temp-storage';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['application/pdf'];
const URL_FETCH_TIMEOUT = 30000; // 30 seconds

/**
 * Extract filename from URL
 */
function extractFileNameFromUrl(url: string): string {
	try {
		const urlObj = new URL(url);
		const pathname = urlObj.pathname;
		const segments = pathname.split('/');
		const lastSegment = segments[segments.length - 1];

		// If last segment has .pdf extension, use it
		if (lastSegment && lastSegment.toLowerCase().endsWith('.pdf')) {
			return lastSegment;
		}

		// Otherwise generate a name
		const hostname = urlObj.hostname.replace(/^www\./, '');
		return `${hostname}-specification.pdf`;
	} catch {
		return 'specification.pdf';
	}
}

/**
 * POST /api/parse-specification/upload
 * Step 1: Upload PDF (file or URL) and save to temp storage
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const formData = await request.formData();
		const file = formData.get('file') as File | null;
		const url = formData.get('url') as string | null;

		// Validate mutually exclusive inputs
		if (file && url) {
			error(400, 'Provide either file or URL, not both');
		}
		if (!file && !url) {
			error(400, 'Either file or url is required');
		}

		let pdfBuffer: Buffer;
		let fileName: string;
		let inputType: 'file' | 'url';
		let inputSource: string | undefined;

		// Handle file upload
		if (file) {
			// Validate file type
			if (!ALLOWED_MIME_TYPES.some((type) => file.type.includes(type))) {
				error(400, 'Invalid file type. Please upload a PDF file.');
			}

			// Validate file size
			if (file.size > MAX_FILE_SIZE) {
				error(400, `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
			}

			pdfBuffer = Buffer.from(await file.arrayBuffer());
			fileName = file.name;
			inputType = 'file';
		}
		// Handle URL download
		else if (url) {
			// Basic URL validation
			let urlObj: URL;
			try {
				urlObj = new URL(url);
				if (!['http:', 'https:'].includes(urlObj.protocol)) {
					error(400, 'Invalid URL. Only HTTP and HTTPS URLs are supported.');
				}
			} catch {
				error(400, 'Invalid URL format');
			}

			// Fetch PDF from URL with timeout
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), URL_FETCH_TIMEOUT);

			try {
				const response = await fetch(url, {
					signal: controller.signal,
					headers: {
						'User-Agent': 'Planck-SpecificationParser/1.0'
					}
				});

				clearTimeout(timeoutId);

				if (!response.ok) {
					error(
						400,
						`Could not download PDF from URL. Server returned ${response.status} ${response.statusText}`
					);
				}

				// Check content type
				const contentType = response.headers.get('content-type');
				if (contentType && !ALLOWED_MIME_TYPES.some((type) => contentType.includes(type))) {
					error(400, 'URL does not point to a PDF file');
				}

				// Check content length
				const contentLength = response.headers.get('content-length');
				if (contentLength && parseInt(contentLength) > MAX_FILE_SIZE) {
					error(400, `PDF file too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
				}

				pdfBuffer = Buffer.from(await response.arrayBuffer());

				// Double-check actual size
				if (pdfBuffer.length > MAX_FILE_SIZE) {
					error(400, `PDF file too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
				}

				fileName = extractFileNameFromUrl(url);
				inputType = 'url';
				inputSource = url;
			} catch (err) {
				if (err instanceof Error && err.name === 'AbortError') {
					error(408, 'PDF download timed out. Please try again or use a different URL.');
				}
				throw err;
			}
		} else {
			// This shouldn't happen due to validation above
			error(400, 'Either file or url is required');
		}

		// Create parse session
		const uploadId = await createParseSession(fileName, pdfBuffer.length, inputType, inputSource);

		// Save PDF to temp storage
		await savePdfToTemp(uploadId, pdfBuffer);

		// Update metadata to mark upload complete
		await updateMetadata(uploadId, {
			steps: { uploaded: true, extracted: false, parsed: false }
		});

		// Return session info
		const metadata = await getMetadata(uploadId);

		return json({
			uploadId,
			fileName: metadata.fileName,
			fileSize: metadata.fileSize,
			expiresAt: metadata.expiresAt
		});
	} catch (err) {
		// Re-throw SvelteKit errors
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		// Handle unexpected errors
		console.error('Unexpected error in upload API:', err);
		error(500, 'An unexpected error occurred. Please try again.');
	}
};
