<script lang="ts">
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import BrandPanel from '$lib/components/BrandPanel.svelte';
	let email = $state('');
	let password = $state('');
	let rememberMe = $state(true);
	let error = $state('');
	async function submit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		const res = await authClient.signIn.email({ email, password, rememberMe });
		if (res.error) error = res.error.message ?? 'Sign in failed';
		else await goto('/agenda');
	}
	const input =
		'h-[46px] w-full rounded-[11px] border border-line bg-white px-3.5 text-[15px] focus:border-pink-200 focus:outline-none';
	const tab = 'flex-1 h-[38px] rounded-[9px] text-sm font-semibold transition';
</script>

<div class="flex h-screen">
	<BrandPanel />
	<div class="flex flex-1 items-center justify-center p-10">
		<div class="w-full max-w-[392px]">
			<h2 class="m-0 mb-1.5 font-display text-[30px] font-medium tracking-[-0.015em]">
				Welcome back
			</h2>
			<p class="m-0 mb-6 text-[15px] text-grey-2">Sign in to pick up where you left off.</p>
			<div class="mb-6 flex gap-1 rounded-[12px] bg-tray p-1">
				<a
					href="/login"
					class={`${tab} flex items-center justify-center bg-white text-ink shadow-[0_1px_3px_rgba(43,37,48,0.08)]`}
					>Sign in</a
				>
				<a href="/signup" class={`${tab} flex items-center justify-center text-grey-2`}
					>Create account</a
				>
			</div>
			<form class="flex flex-col gap-3.5" onsubmit={submit}>
				<label class="block"
					><span class="mb-1.5 block text-[13px] font-semibold text-grey-1">Email address</span>
					<input
						class={input}
						type="email"
						placeholder="you@email.com"
						bind:value={email}
						required
					/></label
				>
				<label class="block"
					><span class="mb-1.5 block text-[13px] font-semibold text-grey-1">Password</span>
					<input
						class={input}
						type="password"
						placeholder="••••••••"
						bind:value={password}
						required
					/></label
				>
				<label class="my-1.5 flex items-center gap-2 text-sm text-grey-1">
					<input type="checkbox" bind:checked={rememberMe} /> Keep me signed in</label
				>
				{#if error}<p class="text-sm text-danger">{error}</p>{/if}
				<button
					type="submit"
					class="flex h-12 w-full items-center justify-center gap-2 rounded-[12px] bg-pink text-[15.5px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(201,86,128,0.65)] hover:bg-pink-hover"
					>Sign in</button
				>
			</form>
		</div>
	</div>
</div>
