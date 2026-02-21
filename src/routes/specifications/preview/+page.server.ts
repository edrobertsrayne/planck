import { redirect, fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { db } from '$lib/server/db';
import { examSpec, topic, specPoint } from '$lib/server/db/schema';
import type { ParsedSpecification } from '$lib/server/openrouter';

/**
 * Validates the parsed specification data
 */
function validateData(data: unknown): data is ParsedSpecification {
	if (!data || typeof data !== 'object') return false;
	const spec = data as Partial<ParsedSpecification>;

	// Validate spec metadata
	if (
		!spec.spec ||
		!spec.spec.board?.trim() ||
		!spec.spec.level ||
		!spec.spec.name?.trim() ||
		!spec.spec.specCode?.trim() ||
		!spec.spec.specYear?.trim()
	) {
		return false;
	}

	// Validate level
	if (spec.spec.level !== 'GCSE' && spec.spec.level !== 'A-Level') {
		return false;
	}

	// Must have at least one topic
	if (!Array.isArray(spec.topics) || spec.topics.length === 0) {
		return false;
	}

	// Validate specPoints array
	if (!Array.isArray(spec.specPoints)) {
		return false;
	}

	return true;
}

export const actions: Actions = {
	save: async ({ request }) => {
		const formData = await request.formData();
		const dataStr = formData.get('data');

		if (!dataStr || typeof dataStr !== 'string') {
			return fail(400, { error: 'No data provided' });
		}

		let parsed: ParsedSpecification;
		try {
			parsed = JSON.parse(dataStr);
		} catch {
			return fail(400, { error: 'Invalid data format' });
		}

		if (!validateData(parsed)) {
			return fail(400, { error: 'Invalid specification data' });
		}

		let newSpecId: string;
		try {
			newSpecId = await db.transaction(async (tx) => {
				// 1. Insert examSpec
				const [newSpec] = await tx
					.insert(examSpec)
					.values({
						board: parsed.spec.board.trim(),
						level: parsed.spec.level,
						name: parsed.spec.name.trim(),
						specCode: parsed.spec.specCode.trim(),
						specYear: parsed.spec.specYear.trim()
					})
					.returning();

				// 2. Insert topics in dependency order (wave-based algorithm)
				// Maps temporary UUID from parsed data to real database UUID
				const topicIdMap = new Map<string, string>();

				// Queue of topics to insert
				let topicsToInsert = [...parsed.topics];
				let previousQueueSize = topicsToInsert.length;

				// Keep inserting waves until queue is empty
				while (topicsToInsert.length > 0) {
					// Find topics whose dependencies are satisfied
					const readyTopics = topicsToInsert.filter(
						(t) => t.parentId === null || topicIdMap.has(t.parentId)
					);

					// If no topics are ready but queue is not empty, we have a circular dependency
					if (readyTopics.length === 0) {
						throw new Error(
							'Circular dependency detected in topic hierarchy. Please check parent-child relationships.'
						);
					}

					// Insert ready topics
					for (const topicData of readyTopics) {
						const [newTopic] = await tx
							.insert(topic)
							.values({
								examSpecId: newSpec.id,
								parentId: topicData.parentId ? topicIdMap.get(topicData.parentId) || null : null,
								name: topicData.name.trim(),
								code: topicData.code.trim(),
								description: topicData.description?.trim() || null,
								sortOrder: topicData.sortOrder
							})
							.returning();

						// Map temporary ID to real database ID
						topicIdMap.set(topicData.id, newTopic.id);
					}

					// Remove inserted topics from queue
					topicsToInsert = topicsToInsert.filter((t) => !readyTopics.some((rt) => rt.id === t.id));

					// Sanity check: ensure we're making progress
					if (topicsToInsert.length === previousQueueSize) {
						throw new Error('Unable to resolve topic dependencies');
					}
					previousQueueSize = topicsToInsert.length;
				}

				// 3. Insert specPoints using mapped topic IDs
				for (const sp of parsed.specPoints) {
					const realTopicId = topicIdMap.get(sp.topicId);
					if (!realTopicId) {
						throw new Error(`Invalid topic reference: ${sp.topicId}`);
					}

					await tx.insert(specPoint).values({
						topicId: realTopicId,
						reference: sp.reference.trim(),
						content: sp.content.trim(),
						notes: sp.notes?.trim() || null,
						tier: sp.tier,
						sortOrder: sp.sortOrder
					});
				}

				// Return the new spec ID
				return newSpec.id;
			});
		} catch (error) {
			console.error('Error saving specification:', error);

			// Check if it's a circular dependency error
			if (error instanceof Error && error.message.includes('Circular dependency')) {
				return fail(400, { error: error.message });
			}

			// Generic error
			return fail(500, {
				error: 'Failed to save specification. Please try again or contact support.'
			});
		}

		// Redirect must be outside try/catch — SvelteKit redirect() throws a special
		// non-Error exception that would otherwise be swallowed by the catch block
		redirect(303, `/specifications/${newSpecId}`);
	}
};
