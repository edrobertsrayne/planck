/**
 * Calculate the current academic year based on the current date.
 * In the UK, the academic year starts on September 1st.
 *
 * @returns Academic year in format "YYYY-YY" (e.g., "2024-25")
 */
export function getCurrentAcademicYear(): string {
	const now = new Date();
	const currentYear = now.getFullYear();
	const currentMonth = now.getMonth(); // 0-indexed (0 = January, 8 = September)

	// If we're before September (month < 8), we're in the previous academic year
	// e.g., March 2025 is in the 2024-25 academic year
	// If we're in or after September (month >= 8), we're in the new academic year
	// e.g., September 2025 is in the 2025-26 academic year
	const startYear = currentMonth >= 8 ? currentYear : currentYear - 1;
	const endYear = startYear + 1;

	// Format as "YYYY-YY"
	return `${startYear}-${endYear.toString().slice(-2)}`;
}
