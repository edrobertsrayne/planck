/**
 * OpenRouter API integration for AI-powered specification parsing
 */

import { OPENROUTER_API_KEY } from '$env/static/private';

export interface ParsedSpecification {
	spec: {
		board: string;
		level: 'GCSE' | 'A-Level';
		name: string;
		specCode: string;
		specYear: string;
	};
	topics: Array<{
		id: string; // Temporary client-side UUID
		parentId: string | null;
		name: string;
		code: string;
		description: string | null;
		sortOrder: number;
	}>;
	specPoints: Array<{
		topicId: string; // Reference to topic's temp ID
		reference: string;
		content: string;
		notes: string | null;
		tier: 'foundation' | 'higher' | 'both';
		sortOrder: number;
	}>;
}

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'google/gemini-2.5-flash';
const MAX_TOKENS = 65536; // gemini-2.5-flash with thinking disabled needs ~31K output tokens
const TEMPERATURE = 0.1;
const TIMEOUT_MS = 300000; // 5 minutes — native PDF processing is slower than text

export interface ParseQuality {
	warnings: string[];
	critical: boolean;
}

export interface ParseResult {
	success: boolean;
	data?: ParsedSpecification;
	quality?: ParseQuality;
	error?: string;
}

/**
 * Analyzes the quality of parsed specification data and returns warnings
 */
function analyzeParseQuality(data: ParsedSpecification): ParseQuality {
	const warnings: string[] = [];
	let critical = false;

	// Check spec point count
	if (data.specPoints.length === 0) {
		warnings.push(
			'No specification points were extracted. UK Physics specifications typically contain 100-300 spec points.'
		);
		critical = true;
	} else if (data.specPoints.length < 20) {
		warnings.push(
			`Only ${data.specPoints.length} specification points found. UK Physics specifications typically contain 100-300 spec points. This may indicate incomplete extraction.`
		);
	}

	// Check for topics without spec points
	const topicIds = new Set(data.topics.map((t) => t.id));
	const topicsWithSpecPoints = new Set(data.specPoints.map((sp) => sp.topicId));
	const topicsWithoutSpecPoints = data.topics.filter((t) => !topicsWithSpecPoints.has(t.id));

	if (topicsWithoutSpecPoints.length > 0) {
		const topicNames = topicsWithoutSpecPoints.map((t) => t.name).join(', ');
		warnings.push(
			`${topicsWithoutSpecPoints.length} topic(s) have no specification points: ${topicNames}`
		);
	}

	return { warnings, critical };
}

/**
 * Validates a parsed specification structure
 */
function validateParsedSpec(data: unknown): data is ParsedSpecification {
	if (!data || typeof data !== 'object') return false;
	const spec = data as Partial<ParsedSpecification>;

	// Validate spec metadata
	if (
		!spec.spec ||
		typeof spec.spec !== 'object' ||
		!spec.spec.board ||
		!spec.spec.level ||
		!spec.spec.name ||
		!spec.spec.specCode ||
		!spec.spec.specYear
	) {
		return false;
	}

	// Validate level is exactly 'GCSE' or 'A-Level'
	if (spec.spec.level !== 'GCSE' && spec.spec.level !== 'A-Level') {
		return false;
	}

	// Validate topics array
	if (!Array.isArray(spec.topics) || spec.topics.length === 0) {
		return false;
	}

	// Validate specPoints array
	if (!Array.isArray(spec.specPoints)) {
		return false;
	}

	// Validate all topic IDs are unique
	const topicIds = new Set<string>();
	for (const topic of spec.topics) {
		if (!topic.id || topicIds.has(topic.id)) return false;
		topicIds.add(topic.id);
	}

	// Validate all specPoint topicIds reference valid topics
	for (const sp of spec.specPoints) {
		if (!sp.topicId || !topicIds.has(sp.topicId)) return false;
		if (!['foundation', 'higher', 'both'].includes(sp.tier)) return false;
	}

	return true;
}

/**
 * JSON Schema for structured outputs from OpenRouter
 */
const SPEC_PARSER_SCHEMA = {
	type: 'object',
	properties: {
		spec: {
			type: 'object',
			properties: {
				board: { type: 'string', description: 'Exam board name (e.g., AQA, OCR, Edexcel)' },
				level: { type: 'string', enum: ['GCSE', 'A-Level'], description: 'Qualification level' },
				name: { type: 'string', description: 'Full specification name' },
				specCode: { type: 'string', description: 'Official specification code' },
				specYear: { type: 'string', description: 'Year specification was introduced' }
			},
			required: ['board', 'level', 'name', 'specCode', 'specYear'],
			additionalProperties: false
		},
		topics: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					id: { type: 'string', description: 'Temporary UUID for this topic' },
					parentId: {
						type: ['string', 'null'],
						description: 'Parent topic ID for nested topics, null for root-level'
					},
					name: { type: 'string', description: 'Topic name' },
					code: { type: 'string', description: 'Topic code (e.g., 4.1, 4.1.1)' },
					description: { type: ['string', 'null'], description: 'Topic description if available' },
					sortOrder: { type: 'number', description: 'Sequential ordering in document' }
				},
				required: ['id', 'parentId', 'name', 'code', 'description', 'sortOrder'],
				additionalProperties: false
			}
		},
		specPoints: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					topicId: { type: 'string', description: 'Reference to parent topic ID' },
					reference: { type: 'string', description: 'Spec point reference code' },
					content: { type: 'string', description: 'The specification point content' },
					notes: { type: ['string', 'null'], description: 'Additional notes or guidance' },
					tier: {
						type: 'string',
						enum: ['foundation', 'higher', 'both'],
						description: 'GCSE tier or both for A-Level'
					},
					sortOrder: { type: 'number', description: 'Sequential ordering within topic' }
				},
				required: ['topicId', 'reference', 'content', 'notes', 'tier', 'sortOrder'],
				additionalProperties: false
			}
		}
	},
	required: ['spec', 'topics', 'specPoints'],
	additionalProperties: false
};

/**
 * Creates the prompt for specification parsing.
 * The PDF is passed as a file content block — the model reads it directly.
 */
function createPrompt(): string {
	return `Extract the subject content specification points from this UK Physics exam specification PDF.

WHAT TO EXTRACT:
- Only the numbered subject content topics (e.g. "4.1 Energy", "4.2 Electricity") and their specification points
- Do NOT include: Working Scientifically, Mathematical Skills/Requirements, Required Practicals lists, Key Ideas, Use of Apparatus sections, or any other non-subject-content sections

TOPIC STRUCTURE — FLAT, ONE LEVEL ONLY:
- Create one topic per numbered section (e.g. "4.1 Energy", "4.1.1 Energy stores and transfers")
- All topics must have parentId: null — do NOT nest topics inside other topics
- If the spec has both section headers (4.1) and subsections (4.1.1, 4.1.2), create a topic for each subsection directly — skip the section header if it has no spec points of its own
- Aim for topics that directly contain spec points, not container sections

SPECIFICATION POINTS:
- Extract every individual learning objective (each bullet point / numbered item)
- Each spec point belongs to exactly one flat topic
- For GCSE: use visual cues in the PDF (shaded/highlighted boxes, HT labels) to set tier:
  - "higher" = Higher Tier only content
  - "both" = content assessed at both Foundation and Higher
  - "foundation" = Foundation only (rare in Physics)
- For A-Level: all spec points use tier "both"

Typical counts for subject content only:
- GCSE Physics: 150-250 spec points across 15-25 topics
- A-Level Physics: 200-350 spec points across 20-35 topics

Return ONLY valid JSON (no markdown, no explanation):
{
  "spec": {
    "board": "string (e.g., AQA, OCR Gateway, Edexcel)",
    "level": "GCSE" | "A-Level",
    "name": "string (e.g., AQA GCSE Physics (8463))",
    "specCode": "string (e.g., 8463)",
    "specYear": "string (e.g., 2016)"
  },
  "topics": [
    {
      "id": "string (e.g., t1, t2)",
      "parentId": null,
      "name": "string (e.g., Energy stores and transfers)",
      "code": "string (e.g., 4.1.1)",
      "description": "string | null",
      "sortOrder": 0
    }
  ],
  "specPoints": [
    {
      "topicId": "string (must match a topic id)",
      "reference": "string (e.g., 4.1.1.1)",
      "content": "string (the learning objective)",
      "notes": "string | null (additional context or guidance text)",
      "tier": "foundation" | "higher" | "both",
      "sortOrder": 0
    }
  ]
}

QUALITY CHECKS - Before returning, verify:
✓ All topics have parentId: null (flat structure)
✓ Only subject content topics are included — no Working Scientifically, no Key Ideas, etc.
✓ Every spec point is linked to a valid topic
✓ Higher-tier content is correctly identified from visual cues in the PDF`;
}

export type PdfInput =
	| { type: 'url'; url: string }
	| { type: 'file'; base64: string; filename: string };

/**
 * Parses a specification using Gemini 2.5 Flash via OpenRouter with structured outputs.
 * Sends the PDF natively so the model reads visual structure (shading, bold text, tables).
 * @param input - Either a URL to the PDF or base64-encoded file data
 */
export async function parseSpecificationWithAI(input: PdfInput): Promise<ParseResult> {
	const apiKey = OPENROUTER_API_KEY;
	if (!apiKey) {
		return {
			success: false,
			error: 'OPENROUTER_API_KEY environment variable is not configured'
		};
	}

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

	try {
		const response = await fetch(OPENROUTER_API_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiKey}`,
				'HTTP-Referer': 'https://planck.app',
				'X-Title': 'Planck - Physics Lesson Planner'
			},
			body: JSON.stringify({
				model: MODEL,
				messages: [
					{
						role: 'user',
						content: [
							{
								type: 'text',
								text: createPrompt()
							},
							{
								type: 'file',
								file: {
									filename:
										input.type === 'url' ? 'specification.pdf' : input.filename,
									file_data:
										input.type === 'url'
											? input.url
											: `data:application/pdf;base64,${input.base64}`
								}
							}
						]
					}
				],
				response_format: {
					type: 'json_schema',
					json_schema: {
						name: 'specification_parser',
						strict: true,
						schema: SPEC_PARSER_SCHEMA
					}
				},
				// Disable thinking mode — thinking tokens eat into max_tokens budget
				// causing truncated output and very slow responses on large documents
				reasoning: { enabled: false },
				max_tokens: MAX_TOKENS,
				temperature: TEMPERATURE
			}),
			signal: controller.signal
		});

		if (!response.ok) {
			if (response.status === 429) {
				throw new Error('AI service rate limit exceeded. Please try again in a few minutes.');
			}
			throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
		}

		const data = await response.json();

		if (!data.choices || !data.choices[0] || !data.choices[0].message) {
			console.error('Invalid OpenRouter response:', JSON.stringify(data, null, 2));
			throw new Error('Invalid response format from OpenRouter API');
		}

		const content = data.choices[0].message.content;

		// Extract JSON from markdown code blocks if present
		let jsonContent = content.trim();

		// Remove markdown code block markers if present
		if (jsonContent.startsWith('```')) {
			// Remove opening ```json or ```
			jsonContent = jsonContent.replace(/^```(?:json)?\s*\n?/, '');
			// Remove closing ```
			jsonContent = jsonContent.replace(/\n?```\s*$/, '');
			jsonContent = jsonContent.trim();
			console.log('Extracted JSON from markdown code block');
		}

		// Debug: show first 200 chars if parsing fails
		let parsed;
		try {
			parsed = JSON.parse(jsonContent);
		} catch (error) {
			console.error('Failed to parse JSON. First 200 chars:', jsonContent.substring(0, 200));
			throw error;
		}

		if (!validateParsedSpec(parsed)) {
			return {
				success: false,
				error: 'AI returned invalid specification structure. Please check the PDF and try again.'
			};
		}

		// Analyze parse quality
		const quality = analyzeParseQuality(parsed);

		// Log for monitoring
		console.info('Specification parsed', {
			board: parsed.spec.board,
			level: parsed.spec.level,
			topics: parsed.topics.length,
			specPoints: parsed.specPoints.length,
			warnings: quality.warnings.length,
			critical: quality.critical
		});

		if (quality.warnings.length > 0) {
			console.warn('Parse quality warnings:', quality.warnings);
		}

		return {
			success: true,
			data: parsed,
			quality
		};
	} catch (error) {
		clearTimeout(timeoutId);

		if (error instanceof Error) {
			if (error.name === 'AbortError') {
				return {
					success: false,
					error: 'Parsing took too long. Please try again or use a smaller PDF.'
				};
			}
			return {
				success: false,
				error: error.message
			};
		}

		return {
			success: false,
			error: 'Failed to parse specification with AI'
		};
	} finally {
		clearTimeout(timeoutId);
	}
}
