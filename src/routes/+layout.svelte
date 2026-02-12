<script lang="ts">
	import type { Snippet } from 'svelte';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import AppNav from '$lib/components/nav/app-nav.svelte';

	let { children }: { children?: Snippet } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="min-h-screen bg-background">
	<AppNav />
	<main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
		{@render children?.()}
	</main>
</div>
