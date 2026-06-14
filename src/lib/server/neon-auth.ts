export interface AuthUser {
	id: string;
	name: string;
	email: string;
	emailVerified?: boolean;
	image?: string | null;
}

export interface AuthSession {
	id: string;
	userId: string;
	expiresAt: string;
}

export interface SessionResult {
	user: AuthUser;
	session: AuthSession;
}

type FetchFn = typeof fetch;

/**
 * Validate the request's session against Neon Auth's hosted get-session endpoint
 * by forwarding the incoming cookie header. Returns null for any unauthenticated
 * or error case so callers can treat "no session" uniformly.
 */
export async function fetchSession(
	fetchFn: FetchFn,
	baseUrl: string,
	sessionPath: string,
	cookie: string
): Promise<SessionResult | null> {
	if (!cookie) return null;

	try {
		const res = await fetchFn(`${baseUrl}${sessionPath}`, { headers: { cookie } });
		if (!res.ok) return null;
		const data = (await res.json()) as Partial<SessionResult> | null;
		if (!data?.user || !data?.session) return null;
		return { user: data.user, session: data.session };
	} catch {
		return null;
	}
}
