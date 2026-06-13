/**
 * Append an alpha channel to a 6-digit hex colour, e.g. withAlpha('#ff0000', 0.5) -> '#ff000080'.
 * Non 6-digit-hex inputs are returned unchanged so caller styles degrade gracefully.
 */
export function withAlpha(hex: string, alpha: number): string {
	if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
	const clamped = Math.max(0, Math.min(1, alpha));
	const a = Math.round(clamped * 255)
		.toString(16)
		.padStart(2, '0');
	return `${hex}${a}`;
}
