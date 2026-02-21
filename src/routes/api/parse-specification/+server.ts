import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseSpecificationWithAI, type PdfInput } from '$lib/server/openrouter';
import { PDFParse } from 'pdf-parse';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['application/pdf'];
const URL_FETCH_TIMEOUT = 30000; // 30 seconds

/**
 * POST /api/parse-specification
 * Accepts either a PDF file upload or a URL to a PDF, extracts text, and parses with AI
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
			} catch (err) {
				if (err instanceof Error && err.name === 'AbortError') {
					error(408, 'PDF download timed out. Please try again or use a different URL.');
				}
				throw err;
			}
		} else {
			// This shouldn't happen due to validation above, but TypeScript needs it
			error(400, 'Either file or url is required');
		}

		// Extract text from PDF using pdf-parse
		// This is more efficient than sending the entire PDF as base64
		let pdfText: string;
		try {
			const parser = new PDFParse({ data: pdfBuffer });
			const textResult = await parser.getText();
			pdfText = textResult.text;
		} catch (err) {
			error(
				400,
				`Failed to extract text from PDF. The file may be corrupted or password-protected. Error: ${err instanceof Error ? err.message : 'Unknown error'}`
			);
		}

		// Validate minimum text content
		if (!pdfText || pdfText.trim().length < 100) {
			error(
				400,
				'PDF does not contain enough text. Please ensure the PDF is a text-based specification document, not a scanned image.'
			);
		}

		// Build PDF input — pass natively so the model reads visual structure
		const pdfInput: PdfInput =
			url && !file
				? { type: 'url', url }
				: { type: 'file', base64: pdfBuffer.toString('base64'), filename: file?.name ?? 'specification.pdf' };

		const result = await parseSpecificationWithAI(pdfInput);

		if (!result.success) {
			error(500, result.error || 'Could not parse specification structure. Please try again.');
		}

		// Return parsed specification with quality data
		return json({
			success: true,
			parsed: result.data,
			quality: result.quality
		});
	} catch (err) {
		// Re-throw SvelteKit errors
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		// Handle unexpected errors
		console.error('Unexpected error in parse-specification API:', err);
		error(500, 'An unexpected error occurred. Please try again.');
	}
};
