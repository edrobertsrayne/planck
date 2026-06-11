<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth-client';

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

<div class="flex min-h-screen">
	<nav class="flex w-48 flex-col gap-1 border-r border-gray-200 p-3">
		<span class="mb-3 px-2 text-lg font-bold">planck</span>
		{#each links as link (link.href)}
			<a
				href={link.href}
				class="rounded px-2 py-1 hover:bg-gray-100"
				class:bg-gray-200={page.url.pathname.startsWith(link.href)}
			>
				{link.label}
			</a>
		{/each}
		<button class="mt-auto rounded px-2 py-1 text-left hover:bg-gray-100" onclick={signOut}>
			Sign out
		</button>
	</nav>
	<main class="flex-1 p-6">
		{@render children()}
	</main>
</div>
