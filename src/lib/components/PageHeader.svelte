<script lang="ts">
	import type { Snippet } from 'svelte';
	let {
		title,
		subtitle,
		eyebrow,
		actions,
		meta
	}: { title: string; subtitle?: string; eyebrow?: string; actions?: Snippet; meta?: Snippet } =
		$props();
</script>

<header class="mb-5">
	{#if eyebrow}
		<div class="mb-1.5 text-[13px] font-semibold text-pink-dk">{eyebrow}</div>
	{/if}
	<div class="flex flex-wrap items-baseline gap-3">
		<h1 class="font-display text-[33px] font-medium tracking-[-0.015em]">{title}</h1>
		{@render meta?.()}
		{#if actions}<div class="ml-auto flex items-center gap-2">{@render actions()}</div>{/if}
	</div>
	{#if subtitle}<p class="mt-1.5 text-[15px] text-grey-2">{subtitle}</p>{/if}
</header>
