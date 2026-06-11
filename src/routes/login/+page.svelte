<script lang="ts">
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth-client';

	let email = $state('');
	let password = $state('');
	let error = $state('');

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		const res = await authClient.signIn.email({ email, password });
		if (res.error) error = res.error.message ?? 'Sign in failed';
		else await goto('/agenda');
	}
</script>

<form class="mx-auto mt-24 flex max-w-sm flex-col gap-3" onsubmit={submit}>
	<h1 class="text-xl font-bold">Sign in to planck</h1>
	<input class="rounded border p-2" type="email" placeholder="Email" bind:value={email} required />
	<input
		class="rounded border p-2"
		type="password"
		placeholder="Password"
		bind:value={password}
		required
	/>
	{#if error}<p class="text-sm text-red-600">{error}</p>{/if}
	<button class="rounded bg-blue-600 p-2 text-white" type="submit">Sign in</button>
	<a class="text-sm text-blue-600" href="/signup">Need an account? Sign up</a>
</form>
