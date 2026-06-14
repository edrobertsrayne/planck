const SECURE_PREFIX = '__Secure-';
const HOST_PREFIX = '__Host-';
const NEON_COOKIE_BASE = 'neon-auth.';

/**
 * Rewrite an outgoing Cookie header (first-party names held by the browser) into
 * the names Neon expects. The browser stores `neon-auth.*` without the
 * `__Secure-` prefix so it works on http://localhost; Neon (always HTTPS) expects
 * the prefixed name.
 */
export function toNeonCookie(cookieHeader: string): string {
	if (!cookieHeader) return '';
	return cookieHeader
		.split(';')
		.map((part) => {
			const trimmed = part.trim();
			const eq = trimmed.indexOf('=');
			if (eq === -1) return part;
			const name = trimmed.slice(0, eq);
			const value = trimmed.slice(eq + 1);
			if (name.startsWith(NEON_COOKIE_BASE)) {
				return `${SECURE_PREFIX}${name}=${value}`;
			}
			return trimmed;
		})
		.join('; ');
}

/**
 * Rewrite a Set-Cookie value from Neon into a first-party app cookie:
 * - strip the `__Secure-`/`__Host-` name prefix (so the cookie works on http dev)
 * - drop `Domain` (host-only) and `Partitioned`
 * - force `Path=/`, `HttpOnly`, `SameSite=Lax`
 * - include `Secure` only when the app is served over HTTPS
 */
export function toFirstPartySetCookie(setCookie: string, opts: { secure: boolean }): string {
	const segments = setCookie.split(';').map((s) => s.trim());
	const [nameValue, ...attrs] = segments;

	const eq = nameValue.indexOf('=');
	let name = eq === -1 ? nameValue : nameValue.slice(0, eq);
	const value = eq === -1 ? '' : nameValue.slice(eq + 1);
	if (name.startsWith(SECURE_PREFIX)) name = name.slice(SECURE_PREFIX.length);
	else if (name.startsWith(HOST_PREFIX)) name = name.slice(HOST_PREFIX.length);

	const kept: string[] = [];
	for (const attr of attrs) {
		const lower = attr.toLowerCase();
		if (
			lower === 'secure' ||
			lower === 'partitioned' ||
			lower === 'httponly' ||
			lower.startsWith('domain=') ||
			lower.startsWith('path=') ||
			lower.startsWith('samesite=')
		) {
			continue; // we re-add the ones we want below
		}
		kept.push(attr); // keep Max-Age / Expires etc.
	}

	const out = [`${name}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', ...kept];
	if (opts.secure) out.push('Secure');
	return out.join('; ');
}
