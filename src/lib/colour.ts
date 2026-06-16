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

const INK = { r: 0x2b, g: 0x25, b: 0x30 };

/** Mix a 6-digit hex toward ink by `amount` (0..1). Non-hex returned unchanged. */
export function darken(hex: string, amount = 0.32): string {
	if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
	const a = Math.max(0, Math.min(1, amount));
	const r = parseInt(hex.slice(1, 3), 16);
	const g = parseInt(hex.slice(3, 5), 16);
	const b = parseInt(hex.slice(5, 7), 16);
	const mix = (c: number, t: number) => Math.round(c + (t - c) * a);
	const h = (n: number) => n.toString(16).padStart(2, '0');
	return `#${h(mix(r, INK.r))}${h(mix(g, INK.g))}${h(mix(b, INK.b))}`;
}

export interface SubjectTint {
	dot: string;
	bar: string;
	bg: string;
	soft: string;
	text: string;
}

/** Reproduce the handoff's per-subject quartet from one stored hex. */
export function subjectTint(hex: string): SubjectTint {
	return {
		dot: hex,
		bar: hex,
		bg: withAlpha(hex, 0.13),
		soft: withAlpha(hex, 0.1),
		text: darken(hex, 0.32)
	};
}
