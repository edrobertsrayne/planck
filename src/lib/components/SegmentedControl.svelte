<script lang="ts">
	type Option = { value: string; label: string };
	let {
		value,
		options,
		onchange
	}: { value: string; options: Option[]; onchange: (v: string) => void } = $props();
</script>

<div class="inline-flex gap-1 rounded-[10px] bg-tray p-1">
	{#each options as o (o.value)}
		<button
			type="button"
			onclick={() => onchange(o.value)}
			class="h-8 rounded-lg px-3.5 text-[13px] font-semibold transition"
			class:bg-white={value === o.value}
			class:text-ink={value === o.value}
			class:shadow-[0_1px_2px_rgba(43,37,48,0.08)]={value === o.value}
			class:text-grey-2={value !== o.value}
		>
			{o.label}
		</button>
	{/each}
</div>
