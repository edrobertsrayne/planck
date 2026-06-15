<script lang="ts">
	import { subjectTint } from '$lib/colour';
	let { period, colour, dim = false }: { period: number; colour: string; dim?: boolean } = $props();
	const t = $derived(subjectTint(colour));
</script>

<div
	class="flex h-[46px] w-[46px] shrink-0 flex-col items-center justify-center gap-px rounded-[12px]"
	style="background:{t.bg};color:{t.text};opacity:{dim ? 0.55 : 1}"
>
	<span class="text-[10px] font-bold tracking-[0.04em] opacity-70">P</span>
	<span class="text-[19px] font-bold leading-none">{period}</span>
</div>
