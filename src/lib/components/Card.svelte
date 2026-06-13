<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		hover = false,
		class: klass = '',
		children
	}: { hover?: boolean; class?: string; children?: Snippet } = $props();
</script>

<div
	class={`rounded-card border border-line bg-white p-4 ${hover ? 'transition hover:border-pink-200 hover:shadow-[0_3px_12px_rgba(80,20,50,0.07)]' : ''} ${klass}`}
>
	{@render children?.()}
</div>
