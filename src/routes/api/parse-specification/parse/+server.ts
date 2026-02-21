import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseSpecificationWithAI, type PdfInput } from '$lib/server/openrouter';
import {
	validateSession,
	getMetadata,
	readPdfFromTemp,
	updateMetadata
} from '$lib/server/parse-temp-storage';

/**
 * POST /api/parse-specification/parse
 * Step 3: Parse extracted text with AI
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
		if (!metadata.steps.extracted) {
			error(400, 'Text extraction not completed. Please extract text first.');
		}

		// Build PDF input — always use stored PDF as base64 so we don't depend on
		// OpenRouter being able to reach the original URL (may be slow or blocked)
		const pdfBuffer = await readPdfFromTemp(uploadId);
		const pdfInput: PdfInput = {
			type: 'file',
			base64: pdfBuffer.toString('base64'),
			filename: metadata.fileName
		};

		// Parse specification with AI
		const result = await parseSpecificationWithAI(pdfInput);

		if (!result.success) {
			// Save error message to metadata
			await updateMetadata(uploadId, { errorMessage: result.error });
			error(500, result.error || 'Could not parse specification structure. Please try again.');
		}

		// Update metadata to mark parsing complete
		await updateMetadata(uploadId, {
			steps: { ...metadata.steps, parsed: true }
		});

		// Return parsed data
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
		console.error('Unexpected error in parse API:', err);
		error(500, 'An unexpected error occurred. Please try again.');
	}
};
