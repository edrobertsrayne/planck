<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import Button from '$lib/components/Button.svelte';

	let { children } = $props();

	const links = [
		{ href: '/agenda', label: 'Agenda' },
		{ href: '/calendar', label: 'Calendar' },
		{ href: '/courses', label: 'Courses' },
		{ href: '/classes', label: 'Classes' },
		{ href: '/timetable', label: 'Timetable' },
		{ href: '/settings', label: 'Settings' }
	];

	async function signOut() {
		await authClient.signOut();
		await goto('/login');
	}
</script>

{#snippet icon(href: string)}
	<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
		{#if href === '/agenda'}
			<rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" />
		{:else if href === '/calendar'}
			<rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 10h18" />
		{:else if href === '/courses'}
			<path d="M4 5v14l8-3 8 3V5l-8 3-8-3z" />
		{:else if href === '/classes'}
			<circle cx="9" cy="8" r="3" /><path d="M3 20c0-3 3-5 6-5s6 2 6 5M16 6a3 3 0 0 1 0 6" />
		{:else if href === '/timetable'}
			<rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M9 9v11M15 9v11" />
		{:else}
			<circle cx="12" cy="12" r="3" /><path
				d="M19 12a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.3 1a7 7 0 0 0-1.7-1l-.4-2.5h-4l-.4 2.5a7 7 0 0 0-1.7 1l-2.3-1-2 3.4 2 1.6a7 7 0 0 0 0 2l-2 1.6 2 3.4 2.3-1a7 7 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7 7 0 0 0 1.7-1l2.3 1 2-3.4-2-1.6c.06-.33.1-.66.1-1z"
			/>
		{/if}
	</svg>
{/snippet}

<div class="flex min-h-screen flex-col">
	<header class="flex items-center gap-4 border-b border-line px-6 py-3">
		<a href="/agenda" class="font-display text-2xl font-bold tracking-tight text-pink-dk">planck</a>
		<div
			class="ml-1 hidden max-w-md flex-1 items-center gap-2 rounded-control border border-line bg-field px-3 py-2 text-sm text-muted md:flex"
		>
			<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
				<circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
			</svg>
			Search lessons, classes, courses…
		</div>
		<details class="relative ml-auto">
			<summary
				class="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full bg-gradient-to-br from-pink-200 to-pink ring-1 ring-line"
				aria-label="Account"
			></summary>
			<div
				class="absolute right-0 z-10 mt-2 w-40 rounded-control border border-line bg-white p-1 shadow-[0_8px_24px_rgba(80,20,50,0.12)]"
			>
				<Button variant="ghost" class="w-full justify-start" onclick={signOut}>Sign out</Button>
			</div>
		</details>
	</header>

	<div class="flex flex-1">
		<nav class="flex w-52 flex-col gap-1 border-r border-line p-3">
			{#each links as link (link.href)}
				{@const active = page.url.pathname.startsWith(link.href)}
				<a
					href={link.href}
					class="flex items-center gap-3 rounded-control px-3 py-2 text-sm font-medium transition"
					class:bg-pink-100={active}
					class:text-pink-dk={active}
					class:font-semibold={active}
					class:text-ink={!active}
					class:hover:bg-field={!active}
				>
					<span class={active ? 'text-pink' : 'text-muted'}>{@render icon(link.href)}</span>
					{link.label}
				</a>
			{/each}
		</nav>
		<main class="flex-1 p-8">
			{@render children()}
		</main>
	</div>
</div>
