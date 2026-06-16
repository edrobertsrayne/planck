<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		hover = false,
		class: klass = '',
		children
	}: { hover?: boolean; class?: string; children?: Snippet } = $props();
</script>

<div
	class={`rounded-card border border-line bg-white p-[18px] shadow-[0_1px_2px_rgba(43,37,48,0.03)] ${hover ? 'transition hover:border-pink-200 hover:shadow-[0_4px_14px_-6px_rgba(43,37,48,0.10)]' : ''} ${klass}`}
>
	{@render children?.()}
</div>
