<script lang="ts">
	import { authClient } from '$lib/auth-client';

	// OAuth lands on the unguarded /auth/callback page, which exchanges Neon's
	// verifier param for a session cookie before continuing into the guarded app.
	let { callbackURL = '/auth/callback' }: { callbackURL?: string } = $props();

	let isRedirecting = $state(false);
	let error = $state('');
	const fallback = 'Unable to continue with Google. Please try again.';

	async function google() {
		error = '';
		isRedirecting = true;
		try {
			const res = await authClient.signIn.social({ provider: 'google', callbackURL });
			if (res?.error) {
				error = res.error.message ?? fallback;
				isRedirecting = false;
			}
			// success → browser redirects to Google; nothing else runs
		} catch (err) {
			error = (err as { message?: string })?.message ?? fallback;
			isRedirecting = false;
		}
	}
</script>

<button
	type="button"
	onclick={google}
	disabled={isRedirecting}
	class="flex h-12 w-full items-center justify-center gap-2.5 rounded-[12px] border border-line bg-white text-[15.5px] font-semibold text-grey-1 transition hover:border-pink-200 disabled:cursor-not-allowed disabled:opacity-60"
>
	<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
		<path
			fill="#4285F4"
			d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
		/>
		<path
			fill="#34A853"
			d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
		/>
		<path
			fill="#FBBC05"
			d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
		/>
		<path
			fill="#EA4335"
			d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
		/>
	</svg>
	{isRedirecting ? 'Connecting…' : 'Continue with Google'}
</button>
{#if error}<p role="alert" class="mt-2 text-sm text-danger">{error}</p>{/if}
