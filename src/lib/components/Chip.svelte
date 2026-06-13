<script lang="ts">
	import type { Snippet } from 'svelte';

	type Tone = 'pink' | 'neutral' | 'success';

	let { tone = 'pink', children }: { tone?: Tone; children?: Snippet } = $props();

	const tones: Record<Tone, string> = {
		pink: 'bg-pink-100 text-pink-dk',
		neutral: 'bg-field text-muted',
		success: 'bg-success-bg text-success'
	};
</script>

<span
	class={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}
>
	{@render children?.()}
</span>
