import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PDFParse } from 'pdf-parse';
import {
	validateSession,
	getMetadata,
	readPdfFromTemp,
	saveExtractedText,
	updateMetadata
} from '$lib/server/parse-temp-storage';

/**
 * POST /api/parse-specification/extract
 * Step 2: Extract text from uploaded PDF
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		// Parse request
		const body = await request.json();
		const { uploadId } = body;

		if (!uploadId) {
			error(400, 'uploadId is required');
		}

		// Validate session
		const isValid = await validateSession(uploadId);
		if (!isValid) {
			error(410, 'Session expired or not found. Please upload the PDF again.');
		}

		// Check prerequisites
		const metadata = await getMetadata(uploadId);
		if (!metadata.steps.uploaded) {
			error(400, 'Upload not completed. Please upload the PDF first.');
		}

		// Read PDF from temp storage
		const pdfBuffer = await readPdfFromTemp(uploadId);

		// Extract text from PDF
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

		// Save extracted text
		await saveExtractedText(uploadId, pdfText);

		// Update metadata
		await updateMetadata(uploadId, {
			steps: { ...metadata.steps, extracted: true },
			textLength: pdfText.length
		});

		// Return success with preview
		return json({
			uploadId,
			textLength: pdfText.length,
			textPreview: pdfText.substring(0, 500)
		});
	} catch (err) {
		// Re-throw SvelteKit errors
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		// Handle unexpected errors
		console.error('Unexpected error in extract API:', err);
		error(500, 'An unexpected error occurred. Please try again.');
	}
};
