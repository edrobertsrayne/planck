import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { toNeonCookie, toFirstPartySetCookie } from '$lib/server/neon-auth-cookies';

async function proxy(event: Parameters<RequestHandler>[0]): Promise<Response> {
	const { request, params, url } = event;
	const baseUrl = env.NEON_AUTH_URL;
	if (!baseUrl) return new Response('NEON_AUTH_URL not set', { status: 500 });

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
		resHeaders.set(key, value);
	}
	// getSetCookie() returns each Set-Cookie separately (Node/undici + SvelteKit support it).
	for (const sc of upstream.headers.getSetCookie?.() ?? []) {
		resHeaders.append('set-cookie', toFirstPartySetCookie(sc, { secure }));
	}

	const resBody = await upstream.arrayBuffer();
	return new Response(resBody, { status: upstream.status, headers: resHeaders });
}

export const GET: RequestHandler = (event) => proxy(event);
export const POST: RequestHandler = (event) => proxy(event);
