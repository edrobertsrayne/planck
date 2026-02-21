import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock $env/static/private before importing the module
vi.mock('$env/static/private', () => ({
	OPENROUTER_API_KEY: 'test-api-key'
}));

import { parseSpecificationWithAI } from './openrouter';

// Mock fetch globally
global.fetch = vi.fn();

describe('parseSpecificationWithAI', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should use the configured OPENROUTER_API_KEY when making API calls', async () => {
		(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: false,
			status: 500,
			statusText: 'Internal Server Error'
		});

		await parseSpecificationWithAI({ type: 'url', url: 'https://example.com/test.pdf' });

		const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
		expect(fetchCall).toBeDefined();
		const headers = fetchCall[1].headers as Record<string, string>;
		expect(headers['Authorization']).toBe('Bearer test-api-key');
	});

	it('should send PDF as file content block for URL inputs', async () => {
		(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: false,
			status: 500,
			statusText: 'Internal Server Error'
		});

		await parseSpecificationWithAI({ type: 'url', url: 'https://example.com/spec.pdf' });

		const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
		const body = JSON.parse(fetchCall[1].body as string);
		const content = body.messages[0].content;
		expect(Array.isArray(content)).toBe(true);
		expect(content[0].type).toBe('text');
		expect(content[1].type).toBe('file');
		expect(content[1].file.file_data).toBe('https://example.com/spec.pdf');
		expect(content[1].file.filename).toBe('specification.pdf');
	});

	it('should send PDF as base64 file content block for file inputs', async () => {
		(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: false,
			status: 500,
			statusText: 'Internal Server Error'
		});

		await parseSpecificationWithAI({
			type: 'file',
			base64: 'dGVzdA==',
			filename: 'physics-spec.pdf'
		});

		const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
		const body = JSON.parse(fetchCall[1].body as string);
		const content = body.messages[0].content;
		expect(Array.isArray(content)).toBe(true);
		expect(content[1].type).toBe('file');
		expect(content[1].file.file_data).toBe('data:application/pdf;base64,dGVzdA==');
		expect(content[1].file.filename).toBe('physics-spec.pdf');
	});

	it('should successfully parse valid AI response', async () => {
		const mockResponse = {
			spec: {
				board: 'AQA',
				level: 'GCSE' as const,
				name: 'AQA GCSE Physics',
				specCode: '8463',
				specYear: '2016'
			},
			topics: [
				{
					id: 'topic-1',
					parentId: null,
					name: 'Energy',
					code: '4.1',
					description: null,
					sortOrder: 0
				}
			],
			specPoints: [
				{
					topicId: 'topic-1',
					reference: '4.1.1',
					content: 'Energy can be stored',
					notes: null,
					tier: 'both' as const,
					sortOrder: 0
				}
			]
		};

		(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			json: async () => ({
				choices: [
					{
						message: {
							content: JSON.stringify(mockResponse)
						}
					}
				]
			})
		});

		const result = await parseSpecificationWithAI({ type: 'url', url: 'https://example.com/test.pdf' });
		expect(result.success).toBe(true);
		expect(result.data).toEqual(mockResponse);
		expect(result.quality).toBeDefined();
	});

	it('should successfully parse with good quality (many spec points)', async () => {
		const mockResponse = {
			spec: {
				board: 'AQA',
				level: 'GCSE' as const,
				name: 'AQA GCSE Physics',
				specCode: '8463',
				specYear: '2016'
			},
			topics: [
				{
					id: 'topic-1',
					parentId: null,
					name: 'Energy',
					code: '4.1',
					description: null,
					sortOrder: 0
				}
			],
			specPoints: Array.from({ length: 50 }, (_, i) => ({
				topicId: 'topic-1',
				reference: `4.1.${i + 1}`,
				content: `Test content ${i + 1}`,
				notes: null,
				tier: 'both' as const,
				sortOrder: i
			}))
		};

		(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			json: async () => ({
				choices: [
					{
						message: {
							content: JSON.stringify(mockResponse)
						}
					}
				]
			})
		});

		const result = await parseSpecificationWithAI({ type: 'url', url: 'https://example.com/test.pdf' });
		expect(result.success).toBe(true);
		expect(result.quality?.warnings.length).toBe(0);
		expect(result.quality?.critical).toBe(false);
	});

	it('should return error for 429 rate limit response', async () => {
		(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: false,
			status: 429,
			statusText: 'Too Many Requests'
		});

		const result = await parseSpecificationWithAI({ type: 'url', url: 'https://example.com/test.pdf' });
		expect(result.success).toBe(false);
		expect(result.error).toContain('rate limit');
	});

	it('should return error for other API errors', async () => {
		(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: false,
			status: 500,
			statusText: 'Internal Server Error'
		});

		const result = await parseSpecificationWithAI({ type: 'url', url: 'https://example.com/test.pdf' });
		expect(result.success).toBe(false);
		expect(result.error).toContain('OpenRouter API error');
	});

	it('should return error for invalid response format', async () => {
		(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			json: async () => ({})
		});

		const result = await parseSpecificationWithAI({ type: 'url', url: 'https://example.com/test.pdf' });
		expect(result.success).toBe(false);
		expect(result.error).toContain('Invalid response format');
	});

	it('should return error for invalid JSON from AI', async () => {
		(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			json: async () => ({
				choices: [
					{
						message: {
							content: 'not valid json'
						}
					}
				]
			})
		});

		const result = await parseSpecificationWithAI({ type: 'url', url: 'https://example.com/test.pdf' });
		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
	});

	it('should validate AI response structure', async () => {
		const invalidResponse = {
			spec: {
				board: 'AQA',
				level: 'InvalidLevel', // Invalid level
				name: 'AQA GCSE Physics',
				specCode: '8463',
				specYear: '2016'
			},
			topics: [],
			specPoints: []
		};

		(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			json: async () => ({
				choices: [
					{
						message: {
							content: JSON.stringify(invalidResponse)
						}
					}
				]
			})
		});

		const result = await parseSpecificationWithAI({ type: 'url', url: 'https://example.com/test.pdf' });
		expect(result.success).toBe(false);
		expect(result.error).toContain('invalid specification structure');
	});

	it('should validate that all specPoint topicIds reference valid topics', async () => {
		const invalidResponse = {
			spec: {
				board: 'AQA',
				level: 'GCSE',
				name: 'AQA GCSE Physics',
				specCode: '8463',
				specYear: '2016'
			},
			topics: [
				{
					id: 'topic-1',
					parentId: null,
					name: 'Energy',
					code: '4.1',
					description: null,
					sortOrder: 0
				}
			],
			specPoints: [
				{
					topicId: 'invalid-topic-id', // Invalid reference
					reference: '4.1.1',
					content: 'Energy can be stored',
					notes: null,
					tier: 'both',
					sortOrder: 0
				}
			]
		};

		(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			json: async () => ({
				choices: [
					{
						message: {
							content: JSON.stringify(invalidResponse)
						}
					}
				]
			})
		});

		const result = await parseSpecificationWithAI({ type: 'url', url: 'https://example.com/test.pdf' });
		expect(result.success).toBe(false);
		expect(result.error).toContain('invalid specification structure');
	});

	it('should require at least one topic', async () => {
		const invalidResponse = {
			spec: {
				board: 'AQA',
				level: 'GCSE',
				name: 'AQA GCSE Physics',
				specCode: '8463',
				specYear: '2016'
			},
			topics: [], // Empty topics array
			specPoints: []
		};

		(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			json: async () => ({
				choices: [
					{
						message: {
							content: JSON.stringify(invalidResponse)
						}
					}
				]
			})
		});

		const result = await parseSpecificationWithAI({ type: 'url', url: 'https://example.com/test.pdf' });
		expect(result.success).toBe(false);
		expect(result.error).toContain('invalid specification structure');
	});

	it('should return error on timeout', async () => {
		// Mock AbortController to simulate timeout
		const mockAbort = vi.fn();
		const originalAbortController = global.AbortController;

		global.AbortController = class MockAbortController {
			signal = { aborted: false };
			abort() {
				mockAbort();
				this.signal.aborted = true;
			}
		} as unknown as typeof AbortController;

		(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
			Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })
		);

		const result = await parseSpecificationWithAI({ type: 'url', url: 'https://example.com/test.pdf' });
		expect(result.success).toBe(false);
		expect(result.error).toContain('took too long');

		global.AbortController = originalAbortController;
	});

	describe('Quality Analysis', () => {
		it('should warn when no spec points are extracted', async () => {
			const mockResponse = {
				spec: {
					board: 'AQA',
					level: 'GCSE' as const,
					name: 'AQA GCSE Physics',
					specCode: '8463',
					specYear: '2016'
				},
				topics: [
					{
						id: 'topic-1',
						parentId: null,
						name: 'Energy',
						code: '4.1',
						description: null,
						sortOrder: 0
					}
				],
				specPoints: []
			};

			(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify(mockResponse)
							}
						}
					]
				})
			});

			const result = await parseSpecificationWithAI({ type: 'url', url: 'https://example.com/test.pdf' });
			expect(result.success).toBe(true);
			expect(result.quality?.critical).toBe(true);
			expect(result.quality?.warnings).toContain(
				'No specification points were extracted. UK Physics specifications typically contain 100-300 spec points.'
			);
		});

		it('should warn when spec point count is low', async () => {
			const mockResponse = {
				spec: {
					board: 'AQA',
					level: 'GCSE' as const,
					name: 'AQA GCSE Physics',
					specCode: '8463',
					specYear: '2016'
				},
				topics: [
					{
						id: 'topic-1',
						parentId: null,
						name: 'Energy',
						code: '4.1',
						description: null,
						sortOrder: 0
					}
				],
				specPoints: [
					{
						topicId: 'topic-1',
						reference: '4.1.1',
						content: 'Test content',
						notes: null,
						tier: 'both' as const,
						sortOrder: 0
					}
				]
			};

			(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify(mockResponse)
							}
						}
					]
				})
			});

			const result = await parseSpecificationWithAI({ type: 'url', url: 'https://example.com/test.pdf' });
			expect(result.success).toBe(true);
			expect(result.quality?.critical).toBe(false);
			expect(result.quality?.warnings.length).toBeGreaterThan(0);
			expect(result.quality?.warnings[0]).toContain('Only 1 specification points found');
		});

		it('should warn when topics have no spec points', async () => {
			const mockResponse = {
				spec: {
					board: 'AQA',
					level: 'GCSE' as const,
					name: 'AQA GCSE Physics',
					specCode: '8463',
					specYear: '2016'
				},
				topics: [
					{
						id: 'topic-1',
						parentId: null,
						name: 'Energy',
						code: '4.1',
						description: null,
						sortOrder: 0
					},
					{
						id: 'topic-2',
						parentId: null,
						name: 'Forces',
						code: '4.2',
						description: null,
						sortOrder: 1
					}
				],
				specPoints: [
					{
						topicId: 'topic-1',
						reference: '4.1.1',
						content: 'Test content',
						notes: null,
						tier: 'both' as const,
						sortOrder: 0
					}
				]
			};

			(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify(mockResponse)
							}
						}
					]
				})
			});

			const result = await parseSpecificationWithAI({ type: 'url', url: 'https://example.com/test.pdf' });
			expect(result.success).toBe(true);
			expect(result.quality?.warnings.some((w) => w.includes('Forces'))).toBe(true);
		});

		it('should pass quality checks with good data', async () => {
			const mockResponse = {
				spec: {
					board: 'AQA',
					level: 'GCSE' as const,
					name: 'AQA GCSE Physics',
					specCode: '8463',
					specYear: '2016'
				},
				topics: [
					{
						id: 'topic-1',
						parentId: null,
						name: 'Energy',
						code: '4.1',
						description: null,
						sortOrder: 0
					}
				],
				specPoints: Array.from({ length: 50 }, (_, i) => ({
					topicId: 'topic-1',
					reference: `4.1.${i + 1}`,
					content: `Test content ${i + 1}`,
					notes: null,
					tier: 'both' as const,
					sortOrder: i
				}))
			};

			(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify(mockResponse)
							}
						}
					]
				})
			});

			const result = await parseSpecificationWithAI({ type: 'url', url: 'https://example.com/test.pdf' });
			expect(result.success).toBe(true);
			expect(result.quality?.critical).toBe(false);
			expect(result.quality?.warnings.length).toBe(0);
		});
	});
});
