import { browser } from '$app/environment';
import { createAuthClient } from '@neondatabase/auth';

// The client talks to the same-origin proxy, which forwards to Neon and rewrites
// cookies to first-party. Absolute origin avoids any ambiguity during the brief
// SSR import window (the client only issues requests in the browser).
const baseURL = browser ? `${window.location.origin}/api/auth` : '/api/auth';

export const authClient = createAuthClient(baseURL);
