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
	it('reuses the source blob (shared pathname), preserving metadata', () => {
		const rows = buildCopiedFileRows(
			[
				{
					blobUrl: 'https://blob/original',
					pathname: 'lesson-files/user-1/original.pdf',
					filename: 'ws.pdf',
					contentType: 'application/pdf',
					size: 1234,
					orderIndex: 0
				}
			],
			'user-1',
			42
		);
		expect(rows).toEqual([
			{
				userId: 'user-1',
				lessonId: null,
				scheduledLessonId: 42,
				blobUrl: 'https://blob/original',
				pathname: 'lesson-files/user-1/original.pdf',
				filename: 'ws.pdf',
				contentType: 'application/pdf',
				size: 1234,
				orderIndex: 0
			}
		]);
	});
});
