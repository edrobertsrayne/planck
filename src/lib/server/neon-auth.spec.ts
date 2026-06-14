import { describe, it, expect, vi } from 'vitest';
import { fetchSession } from './neon-auth';

const BASE = 'https://auth.example.com';
const SESSION_PATH = '/get-session';

describe('fetchSession', () => {
	it('returns null when there is no cookie header', async () => {
		const fetchFn = vi.fn();
		const result = await fetchSession(fetchFn, BASE, SESSION_PATH, '');
		expect(result).toBeNull();
		expect(fetchFn).not.toHaveBeenCalled();
	});

	it('forwards the cookie and returns user + session on success', async () => {
		const body = {
			user: { id: 'u1', name: 'Ada', email: 'ada@example.com' },
			session: { id: 's1', userId: 'u1', expiresAt: '2030-01-01T00:00:00Z' }
		};
		const fetchFn = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));

		const result = await fetchSession(fetchFn, BASE, SESSION_PATH, 'better-auth.session=abc');

		expect(fetchFn).toHaveBeenCalledWith(`${BASE}${SESSION_PATH}`, {
			headers: { cookie: 'better-auth.session=abc' }
		});
		expect(result).toEqual(body);
	});

	it('returns null on a non-OK response', async () => {
		const fetchFn = vi.fn(async () => new Response('nope', { status: 401 }));
		const result = await fetchSession(fetchFn, BASE, SESSION_PATH, 'better-auth.session=abc');
		expect(result).toBeNull();
	});

	it('returns null when the body has no user', async () => {
		const fetchFn = vi.fn(async () => new Response(JSON.stringify(null), { status: 200 }));
		const result = await fetchSession(fetchFn, BASE, SESSION_PATH, 'better-auth.session=abc');
		expect(result).toBeNull();
	});

	it('returns null when fetch throws', async () => {
		const fetchFn = vi.fn(async () => {
			throw new Error('network');
		});
		const result = await fetchSession(fetchFn, BASE, SESSION_PATH, 'better-auth.session=abc');
		expect(result).toBeNull();
	});
});
