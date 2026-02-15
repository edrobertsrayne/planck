/**
 * Utility functions for determining key stage colors based on year groups.
 * These functions are used throughout the application to display consistent
 * color indicators for classes.
 */

/**
 * Get the CSS variable for the key stage color based on year group.
 *
 * @param yearGroup - The year group (7-13)
 * @returns CSS variable string for the key stage color
 */
export function getKeyStageColor(yearGroup: number): string {
	if (yearGroup >= 7 && yearGroup <= 9) {
		return 'var(--ks3-color)';
	} else if (yearGroup >= 10 && yearGroup <= 11) {
		return 'var(--gcse-color)';
	} else if (yearGroup >= 12 && yearGroup <= 13) {
		return 'var(--alevel-color)';
	}
	return 'var(--text-muted)';
}

/**
 * Get the key stage label based on year group.
 *
 * @param yearGroup - The year group (7-13)
 * @returns Key stage label (KS3, GCSE, A-Level) or empty string
 */
export function getKeyStageLabel(yearGroup: number): string {
	if (yearGroup >= 7 && yearGroup <= 9) {
		return 'KS3';
	} else if (yearGroup >= 10 && yearGroup <= 11) {
		return 'GCSE';
	} else if (yearGroup >= 12 && yearGroup <= 13) {
		return 'A-Level';
	}
	return '';
}
