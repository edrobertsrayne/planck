<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		subtitle,
		actions,
		meta
	}: { title: string; subtitle?: string; actions?: Snippet; meta?: Snippet } = $props();
</script>

<header class="mb-6">
	<div class="flex flex-wrap items-baseline gap-3">
		<h1 class="font-display text-3xl font-semibold tracking-tight">{title}</h1>
		{@render meta?.()}
		{#if actions}<div class="ml-auto flex items-center gap-2">{@render actions()}</div>{/if}
	</div>
	{#if subtitle}<p class="mt-1 text-sm text-muted">{subtitle}</p>{/if}
</header>
