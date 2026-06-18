import { render } from 'vitest-browser-svelte';
import { expect, test, vi, beforeEach } from 'vitest';
import Callback from './+page.svelte';
import { authClient } from '$lib/auth-client';
import { goto } from '$app/navigation';

// Neon Auth completes OAuth by landing here with a `neon_auth_session_verifier`
// URL param; calling getSession() lets the better-auth client exchange it for a
// first-party session cookie before we move on to the guarded app.
vi.mock('$lib/auth-client', () => ({ authClient: { getSession: vi.fn() } }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

const getSession = authClient.getSession as unknown as ReturnType<typeof vi.fn>;
const gotoMock = goto as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
	getSession.mockReset();
	gotoMock.mockReset();
});

test('exchanges the verifier then redirects into the app on success', async () => {
	getSession.mockResolvedValue({ data: { session: { id: 's1' } }, error: null });
	render(Callback);
	await vi.waitFor(() => {
		expect(getSession).toHaveBeenCalledTimes(1);
		expect(gotoMock).toHaveBeenCalledWith('/agenda', { invalidateAll: true });
	});
});

test('shows an error and does not redirect when the exchange fails', async () => {
	getSession.mockResolvedValue({ data: null, error: { message: 'bad verifier' } });
	const screen = render(Callback);
	await expect.element(screen.getByRole('alert')).toBeInTheDocument();
	expect(gotoMock).not.toHaveBeenCalled();
});
