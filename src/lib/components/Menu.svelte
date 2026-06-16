<script lang="ts">
	import type { Snippet } from 'svelte';
	let {
		open,
		onclose,
		class: klass = '',
		children
	}: { open: boolean; onclose: () => void; class?: string; children: Snippet } = $props();
</script>

{#if open}
	<button
		type="button"
		aria-label="Close menu"
		class="fixed inset-0 z-30 cursor-default"
		onclick={onclose}
	></button>
	<div
		class={`absolute z-[31] rounded-[13px] border border-line bg-white p-[7px] shadow-[0_16px_36px_-12px_rgba(43,37,48,0.28)] ${klass}`}
	>
		{@render children()}
	</div>
{/if}
