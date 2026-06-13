import { describe, it, expect } from 'vitest';
import { buildCopiedLinkRows, buildCopiedFileRows } from './copy';

describe('buildCopiedLinkRows', () => {
	it('repoints template links to a scheduled lesson, preserving order/labels', () => {
		const rows = buildCopiedLinkRows(
			[
				{ url: 'https://a.com', label: 'A', orderIndex: 0 },
				{ url: 'https://b.com', label: null, orderIndex: 1 }
			],
			'user-1',
			42
		);
		expect(rows).toEqual([
			{
				userId: 'user-1',
				lessonId: null,
				scheduledLessonId: 42,
				url: 'https://a.com',
				label: 'A',
				orderIndex: 0
			},
			{
				userId: 'user-1',
				lessonId: null,
				scheduledLessonId: 42,
				url: 'https://b.com',
				label: null,
				orderIndex: 1
			}
		]);
	});
});

describe('buildCopiedFileRows', () => {
	it('pairs each template file with its copied blob, preserving metadata', () => {
		const rows = buildCopiedFileRows(
			[{ filename: 'ws.pdf', contentType: 'application/pdf', size: 1234, orderIndex: 0 }],
			[{ blobUrl: 'https://blob/new', pathname: 'lesson-files/user-1/new.pdf' }],
			'user-1',
			42
		);
		expect(rows).toEqual([
			{
				userId: 'user-1',
				lessonId: null,
				scheduledLessonId: 42,
				blobUrl: 'https://blob/new',
				pathname: 'lesson-files/user-1/new.pdf',
				filename: 'ws.pdf',
				contentType: 'application/pdf',
				size: 1234,
				orderIndex: 0
			}
		]);
	});

	it('throws when files and copies lengths differ', () => {
		expect(() => buildCopiedFileRows([], [{ blobUrl: 'x', pathname: 'y' }], 'u', 1)).toThrow(
			/length mismatch/
		);
	});
});
