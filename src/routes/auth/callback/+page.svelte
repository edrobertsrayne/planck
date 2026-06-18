<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth-client';

	// Neon Auth's OAuth flow returns here with a `neon_auth_session_verifier` URL
	// param. Calling getSession() lets the better-auth client exchange that verifier
	// for a first-party session cookie (via the /api/auth proxy) before we navigate
	// into the guarded app — otherwise the server guard runs with no cookie yet and
	// bounces straight to /login.
	let failed = $state(false);

	onMount(async () => {
		try {
			const res = await authClient.getSession();
			if (res?.error) {
				failed = true;
				return;
			}
			await goto('/agenda', { invalidateAll: true });
		} catch {
			failed = true;
		}
	});
</script>

<div class="flex h-screen items-center justify-center p-10 text-center text-[15px] text-grey-2">
	{#if failed}
		<p role="alert" class="text-danger">
			Sign-in could not be completed. <a class="font-semibold text-pink underline" href="/login"
				>Return to login</a
			>
		</p>
	{:else}
		<p>Signing you in…</p>
	{/if}
</div>
