import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { toNeonCookie, toFirstPartySetCookie } from '$lib/server/neon-auth-cookies';

async function proxy(event: Parameters<RequestHandler>[0]): Promise<Response> {
	const { request, params, url } = event;
	const baseUrl = env.NEON_AUTH_BASE_URL;
	if (!baseUrl) return new Response('NEON_AUTH_BASE_URL not set', { status: 500 });

	const target = `${baseUrl}/${params.path}${url.search}`;

	const headers = new Headers();
	const contentType = request.headers.get('content-type');
	if (contentType) headers.set('content-type', contentType);
	const cookie = request.headers.get('cookie') ?? '';
	if (cookie) headers.set('cookie', toNeonCookie(cookie));
	// Neon validates Origin against its trusted list; always send the registered one.
	headers.set('origin', env.NEON_AUTH_ORIGIN ?? url.origin);

	// Forward a body only when there is one. An empty-string body can trip undici
	// ("fetch failed") on a zero-length HTTP/2 POST, and forwarding undefined lets
	// the upstream return its own response (e.g. 400) instead of the proxy throwing.
	let body: string | undefined;
	if (request.method !== 'GET' && request.method !== 'HEAD') {
		const raw = await request.text();
		body = raw.length > 0 ? raw : undefined;
	}

	const upstream = await fetch(target, {
		method: request.method,
		headers,
		body,
		redirect: 'manual'
	});

	const secure = url.protocol === 'https:';
	const resHeaders = new Headers();
	for (const [key, value] of upstream.headers) {
		const lower = key.toLowerCase();
		if (lower === 'set-cookie') continue; // handled below
		if (lower === 'content-encoding' || lower === 'content-length' || lower === 'transfer-encoding')
			continue; // let the platform recompute
		if (lower === 'location') {
			// Keep redirects on the app origin: rewrite any absolute Neon URL back
			// through this proxy so the browser never hits Neon directly.
			resHeaders.set(
				key,
				value.startsWith(baseUrl) ? `/api/auth${value.slice(baseUrl.length)}` : value
			);
			continue;
		}
		resHeaders.set(key, value);
	}
	// getSetCookie() returns each Set-Cookie separately. Fall back to the single
	// header so auth cookies are never silently dropped if it's unavailable.
	const setCookies = upstream.headers.getSetCookie?.() ?? [];
	const rawSetCookie = upstream.headers.get('set-cookie');
	if (setCookies.length === 0 && rawSetCookie) setCookies.push(rawSetCookie);
	for (const sc of setCookies) {
		resHeaders.append('set-cookie', toFirstPartySetCookie(sc, { secure }));
	}

	const resBody = await upstream.arrayBuffer();
	return new Response(resBody, { status: upstream.status, headers: resHeaders });
}

export const GET: RequestHandler = (event) => proxy(event);
export const POST: RequestHandler = (event) => proxy(event);
