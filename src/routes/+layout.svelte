<script lang="ts">
	import type { Snippet } from 'svelte';
	import { browser } from '$app/environment';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import AppNav from '$lib/components/nav/app-nav.svelte';
	import { getStoredAccentColor, applyAccentColor } from '$lib/utils/accent-color';

	let { children }: { children?: Snippet } = $props();

	// Initialize accent color from localStorage on mount
	$effect(() => {
		if (browser) {
			const accentColor = getStoredAccentColor();
			applyAccentColor(accentColor);
		}
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="min-h-screen bg-background">
	<AppNav />
	<main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
		{@render children?.()}
	</main>
</div>
