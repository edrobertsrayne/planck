<script lang="ts">
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';

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

	const inputClass =
		'rounded-control border border-line bg-field px-3 py-2.5 text-sm focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink-100';
</script>

<div class="mx-auto mt-24 max-w-sm px-4">
	<h1 class="mb-1 text-center font-display text-3xl font-bold text-pink-dk">planck</h1>
	<p class="mb-6 text-center text-sm text-muted">Create your account</p>
	<Card>
		<form class="flex flex-col gap-3" onsubmit={submit}>
			<input class={inputClass} placeholder="Name" bind:value={name} required />
			<input class={inputClass} type="email" placeholder="Email" bind:value={email} required />
			<input
				class={inputClass}
				type="password"
				placeholder="Password"
				bind:value={password}
				required
			/>
			{#if error}<p class="text-sm text-danger">{error}</p>{/if}
			<Button type="submit">Sign up</Button>
			<a class="text-center text-sm text-pink-dk hover:underline" href="/login"
				>Have an account? Sign in</a
			>
		</form>
	</Card>
</div>
