export type CronAuth = { authorized: true } | { authorized: false; status: 401 | 503 };

/** Constant-time-ish string equality: no early return on a per-char mismatch. */
function safeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

/**
 * Authorize a cron request. Fails closed: a missing/empty secret yields 503 (the
 * job is misconfigured, never purge); a missing or wrong bearer yields 401.
 * Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` automatically.
 */
export function isAuthorizedCron(header: string | null, secret: string | undefined): CronAuth {
	if (!secret) return { authorized: false, status: 503 };
	if (!header || !safeEqual(header, `Bearer ${secret}`)) {
		return { authorized: false, status: 401 };
	}
	return { authorized: true };
}
