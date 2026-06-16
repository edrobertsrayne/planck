import { describe, it, expect } from 'vitest';
import { linkMeta, fileMeta } from './meta';

describe('linkMeta', () => {
	it('classifies youtube and falls back to host', () => {
		expect(linkMeta('https://youtube.com/watch?v=x').type).toBe('youtube');
		expect(linkMeta('https://docs.google.com/d/1').type).toBe('google');
		expect(linkMeta('https://example.com/a').host).toBe('example.com');
	});
});

describe('fileMeta', () => {
	it('maps extension to a kind label', () => {
		expect(fileMeta('a.pdf').kind).toBe('PDF');
		expect(fileMeta('a.docx').kind).toBe('DOC');
		expect(fileMeta('a.unknown').kind).toBe('FILE');
	});
});
