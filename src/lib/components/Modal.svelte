<script lang="ts">
	import type { Snippet } from 'svelte';
	let { onclose, children }: { onclose: () => void; children: Snippet } = $props();
	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}
</script>

<svelte:window {onkeydown} />
<div class="fixed inset-0 z-[60] flex items-center justify-center p-6">
	<button
		type="button"
		aria-label="Close"
		class="absolute inset-0 bg-[rgba(43,37,48,0.42)]"
		onclick={onclose}
	></button>
	<div
		role="dialog"
		aria-modal="true"
		class="relative w-full max-w-[446px] overflow-hidden rounded-[20px] bg-white shadow-[0_30px_70px_-20px_rgba(43,37,48,0.5)]"
	>
		{@render children()}
	</div>
</div>
