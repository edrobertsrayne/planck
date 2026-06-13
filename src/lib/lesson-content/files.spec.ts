import { describe, it, expect } from 'vitest';
import { validateFile, applyOrder, MAX_FILE_BYTES, ALLOWED_CONTENT_TYPES } from './files';

describe('validateFile', () => {
	it('accepts an allowed type within the size limit', () => {
		expect(validateFile({ contentType: 'application/pdf', size: 1000 })).toEqual({ ok: true });
	});

	it('rejects a disallowed content type', () => {
		const r = validateFile({ contentType: 'application/x-msdownload', size: 1000 });
		expect(r.ok).toBe(false);
	});

	it('rejects a file over the size limit', () => {
		const r = validateFile({ contentType: 'application/pdf', size: MAX_FILE_BYTES + 1 });
		expect(r.ok).toBe(false);
	});

	it('exposes the allowlist including pdf and png', () => {
		expect(ALLOWED_CONTENT_TYPES).toContain('application/pdf');
		expect(ALLOWED_CONTENT_TYPES).toContain('image/png');
	});
});

describe('applyOrder', () => {
	it('assigns sequential orderIndex values from the given id order', () => {
		expect(applyOrder([5, 2, 9])).toEqual([
			{ id: 5, orderIndex: 0 },
			{ id: 2, orderIndex: 1 },
			{ id: 9, orderIndex: 2 }
		]);
	});
});
