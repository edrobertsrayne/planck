<script lang="ts">
	let {
		colour,
		shape = 'dot'
	}: { colour: string; shape?: 'dot' | 'bar' } = $props();
</script>

{#if shape === 'bar'}
	<span class="w-1 self-stretch rounded" style="background:{colour}" aria-hidden="true"></span>
{:else}
	<span
		class="inline-block h-3.5 w-3.5 shrink-0 rounded"
		style="background:{colour}"
		aria-hidden="true"
	></span>
{/if}
