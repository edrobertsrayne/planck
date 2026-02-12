import { db } from '$lib/server/db';
import { examSpec } from '$lib/server/db/schema';
import { asc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// Get all exam specifications ordered by level then board
	const specs = await db
		.select({
			id: examSpec.id,
			board: examSpec.board,
			level: examSpec.level,
			name: examSpec.name,
			specCode: examSpec.specCode,
			specYear: examSpec.specYear
		})
		.from(examSpec)
		.orderBy(asc(examSpec.level), asc(examSpec.board));

	return {
		specs
	};
};
