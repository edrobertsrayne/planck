<script lang="ts">
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import { PASSWORD_MIN_LENGTH, passwordProblem } from '$lib/auth/password';
	import BrandPanel from '$lib/components/BrandPanel.svelte';
	import OAuthButtons from '$lib/components/OAuthButtons.svelte';
	let name = $state('');
	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let error = $state('');
	let isSubmitting = $state(false);
	const fallback = 'Unable to create account. Please try again.';
	async function submit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		const problem = passwordProblem(password, confirmPassword);
		if (problem) {
			error = problem;
			return;
		}
		isSubmitting = true;
		try {
			const res = await authClient.signUp.email({ name, email, password });
			if (res.error) error = res.error.message ?? fallback;
			else await goto('/agenda');
		} catch (err) {
			error = (err as { message?: string })?.message ?? fallback;
		} finally {
			isSubmitting = false;
		}
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
				Create your account
			</h2>
			<p class="m-0 mb-6 text-[15px] text-grey-2">Start planning your term in minutes.</p>
			<div class="mb-6 flex gap-1 rounded-[12px] bg-tray p-1">
				<a href="/login" class={`${tab} flex items-center justify-center text-grey-2`}>Sign in</a>
				<a
					href="/signup"
					class={`${tab} flex items-center justify-center bg-white text-ink shadow-[0_1px_3px_rgba(43,37,48,0.08)]`}
					>Create account</a
				>
			</div>
			<form class="flex flex-col gap-3.5" onsubmit={submit}>
				<label class="block"
					><span class="mb-1.5 block text-[13px] font-semibold text-grey-1">Full name</span>
					<input
						class={input}
						type="text"
						placeholder="Sofia Marsh"
						bind:value={name}
						required
					/></label
				>
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
						minlength={PASSWORD_MIN_LENGTH}
						required
					/></label
				>
				<label class="block"
					><span class="mb-1.5 block text-[13px] font-semibold text-grey-1">Confirm password</span>
					<input
						class={input}
						type="password"
						placeholder="••••••••"
						bind:value={confirmPassword}
						minlength={PASSWORD_MIN_LENGTH}
						required
					/></label
				>
				<p class="my-1.5 text-[13px] leading-[1.4] text-grey-2">
					By creating an account you agree to our Terms &amp; Privacy Policy.
				</p>
				{#if error}<p role="alert" class="text-sm text-danger">{error}</p>{/if}
				<button
					type="submit"
					disabled={isSubmitting}
					class="flex h-12 w-full items-center justify-center gap-2 rounded-[12px] bg-pink text-[15.5px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(201,86,128,0.65)] hover:bg-pink-hover disabled:cursor-not-allowed disabled:opacity-60"
					>{isSubmitting ? 'Creating account…' : 'Create account'}</button
				>
			</form>
			<div class="my-5 flex items-center gap-3 text-[13px] text-grey-2">
				<span class="h-px flex-1 bg-line"></span>or<span class="h-px flex-1 bg-line"></span>
			</div>
			<OAuthButtons />
		</div>
	</div>
</div>
