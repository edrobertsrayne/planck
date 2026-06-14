import { describe, it, expect } from 'vitest';
import { toNeonCookie, toFirstPartySetCookie } from './neon-auth-cookies';

describe('toNeonCookie', () => {
	it('adds the __Secure- prefix to neon-auth cookies', () => {
		expect(toNeonCookie('neon-auth.session_token=abc')).toBe(
			'__Secure-neon-auth.session_token=abc'
		);
	});

	it('passes through unrelated cookies unchanged and preserves order', () => {
		expect(toNeonCookie('foo=1; neon-auth.session_token=abc; bar=2')).toBe(
			'foo=1; __Secure-neon-auth.session_token=abc; bar=2'
		);
	});

	it('does not double-prefix an already-prefixed cookie', () => {
		expect(toNeonCookie('__Secure-neon-auth.session_token=abc')).toBe(
			'__Secure-neon-auth.session_token=abc'
		);
	});

	it('returns empty string for empty input', () => {
		expect(toNeonCookie('')).toBe('');
	});
});

describe('toFirstPartySetCookie', () => {
	it('strips __Secure- prefix, drops Partitioned/Domain, sets SameSite=Lax, adds Secure when https', () => {
		const input =
			'__Secure-neon-auth.session_token=abc; Max-Age=604800; Path=/; HttpOnly; Secure; SameSite=None; Partitioned';
		const out = toFirstPartySetCookie(input, { secure: true });
		expect(out).toContain('neon-auth.session_token=abc');
		expect(out).not.toContain('__Secure-');
		expect(out).not.toMatch(/Partitioned/i);
		expect(out).not.toMatch(/Domain=/i);
		expect(out).toMatch(/SameSite=Lax/i);
		expect(out).toMatch(/HttpOnly/i);
		expect(out).toMatch(/Path=\//i);
		expect(out).toMatch(/Secure/i);
		expect(out).toMatch(/Max-Age=604800/i);
	});

	it('omits Secure when not https (dev)', () => {
		const input = '__Secure-neon-auth.session_token=abc; Path=/; HttpOnly; Secure; SameSite=None';
		const out = toFirstPartySetCookie(input, { secure: false });
		expect(out).not.toMatch(/(^|;|\s)Secure(;|$)/i);
		expect(out).toContain('neon-auth.session_token=abc');
	});

	it('preserves a deletion cookie (empty value, Max-Age=0)', () => {
		const input =
			'__Secure-neon-auth.session_token=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=None';
		const out = toFirstPartySetCookie(input, { secure: true });
		expect(out).toContain('neon-auth.session_token=;');
		expect(out).toMatch(/Max-Age=0/i);
	});
});
