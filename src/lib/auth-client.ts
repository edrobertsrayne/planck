import { browser } from '$app/environment';
import { createAuthClient } from '@neondatabase/auth';

// The client talks to the same-origin /api/auth proxy, which forwards to Neon and
// rewrites cookies to first-party. createAuthClient validates its base URL at
// construction and rejects a relative one, and the app origin isn't known during
// SSR — so we build it lazily, browser-only, on first use. Every auth call
// (signIn/signUp/signOut/getSession) happens in the browser, never during SSR.
function build() {
	return createAuthClient(`${window.location.origin}/api/auth`);
}
type Client = ReturnType<typeof build>;

let instance: Client | undefined;
function resolve(): Client {
	if (!browser) throw new Error('authClient is browser-only and cannot be used during SSR');
	if (!instance) instance = build();
	return instance;
}

export const authClient = new Proxy({} as Client, {
	get(_target, prop) {
		const client = resolve();
		const value = Reflect.get(client, prop);
		return typeof value === 'function' ? value.bind(client) : value;
	}
});
