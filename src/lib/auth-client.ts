import { createAuthClient } from '@neondatabase/auth';
import { PUBLIC_NEON_AUTH_URL } from '$env/static/public';

export const authClient = createAuthClient(PUBLIC_NEON_AUTH_URL);
