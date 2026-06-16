<script lang="ts">
	import type { Snippet } from 'svelte';

	let { label, children }: { label: string; children?: Snippet } = $props();
</script>

<label class="flex flex-col gap-1.5 text-[13px] font-semibold text-grey-1">
	{label}
	{@render children?.()}
</label>
