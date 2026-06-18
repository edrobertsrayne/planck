/**
 * Of the candidate pathnames, the ones safe to delete from blob storage:
 * those not present in `stillReferenced` (the pathnames still backed by a
 * `resource_file` row after the delete). De-duplicated, order preserved.
 */
export function pathnamesToReclaim(candidates: string[], stillReferenced: string[]): string[] {
	const referenced = new Set(stillReferenced);
	return [...new Set(candidates)].filter((p) => !referenced.has(p));
}
