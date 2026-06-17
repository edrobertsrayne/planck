import { render } from 'vitest-browser-svelte';
import { expect, test, vi, beforeEach } from 'vitest';
import OAuthButtons from './OAuthButtons.svelte';
import { authClient } from '$lib/auth-client';

vi.mock('$lib/auth-client', () => ({
	authClient: { signIn: { social: vi.fn() } }
}));

const social = authClient.signIn.social as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
	social.mockReset();
});

test('clicking the Google button starts a google social sign-in to /agenda', async () => {
	social.mockReturnValue(new Promise(() => {})); // never resolves (redirect in flight)
	const screen = render(OAuthButtons);
	await screen.getByRole('button', { name: /continue with google/i }).click();
	expect(social).toHaveBeenCalledTimes(1);
	expect(social).toHaveBeenCalledWith({ provider: 'google', callbackURL: '/agenda' });
});

test('surfaces the provider error message in an alert', async () => {
	social.mockResolvedValue({ error: { message: 'Google is unavailable' } });
	const screen = render(OAuthButtons);
	await screen.getByRole('button', { name: /continue with google/i }).click();
	await expect.element(screen.getByRole('alert')).toHaveTextContent('Google is unavailable');
});

test('surfaces the thrown error message when the call throws with one', async () => {
	social.mockRejectedValue(new Error('network down'));
	const screen = render(OAuthButtons);
	await screen.getByRole('button', { name: /continue with google/i }).click();
	await expect.element(screen.getByRole('alert')).toHaveTextContent('network down');
});

test('falls back to a generic message when the failure has no message', async () => {
	social.mockRejectedValue({});
	const screen = render(OAuthButtons);
	await screen.getByRole('button', { name: /continue with google/i }).click();
	await expect
		.element(screen.getByRole('alert'))
		.toHaveTextContent('Unable to continue with Google. Please try again.');
});

test('clears the error and re-enables the button so the user can retry', async () => {
	social.mockRejectedValueOnce(new Error('network down'));
	const screen = render(OAuthButtons);
	const button = screen.getByRole('button', { name: /continue with google/i });
	await button.click();
	await expect.element(screen.getByRole('alert')).toHaveTextContent('network down');
	// Second attempt: handler clears the error and the button is enabled again so the click lands.
	social.mockReturnValueOnce(new Promise(() => {}));
	await button.click();
	expect(social).toHaveBeenCalledTimes(2);
	await expect.element(screen.getByRole('alert')).not.toBeInTheDocument();
});
