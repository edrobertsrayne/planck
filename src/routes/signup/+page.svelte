<script lang="ts">
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth-client';

	let name = $state('');
	let email = $state('');
	let password = $state('');
	let error = $state('');

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		const res = await authClient.signUp.email({ name, email, password });
		if (res.error) error = res.error.message ?? 'Sign up failed';
		else await goto('/agenda');
	}
</script>

<form class="mx-auto mt-24 flex max-w-sm flex-col gap-3" onsubmit={submit}>
	<h1 class="text-xl font-bold">Create your planck account</h1>
	<input class="rounded border p-2" placeholder="Name" bind:value={name} required />
	<input class="rounded border p-2" type="email" placeholder="Email" bind:value={email} required />
	<input
		class="rounded border p-2"
		type="password"
		placeholder="Password"
		bind:value={password}
		required
	/>
	{#if error}<p class="text-sm text-red-600">{error}</p>{/if}
	<button class="rounded bg-blue-600 p-2 text-white" type="submit">Sign up</button>
	<a class="text-sm text-blue-600" href="/login">Have an account? Sign in</a>
</form>
