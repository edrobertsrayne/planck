<script lang="ts">
	import { onMount, onDestroy, untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import Button from './Button.svelte';

	let { value = '', saveAction }: { value?: string; saveAction: string } = $props();

	let editorEl: HTMLDivElement;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let crepe: any = null;
	// markdown is initialised once from the prop; the crepe editor owns its content thereafter.
	// untrack prevents Svelte from warning about capturing the initial prop value in $state.
	let markdown = $state<string>(untrack(() => value));

	onMount(async () => {
		const { Crepe } = await import('@milkdown/crepe');
		await import('@milkdown/crepe/theme/common/style.css');
		await import('@milkdown/crepe/theme/frame.css');
		crepe = new Crepe({ root: editorEl, defaultValue: value });
		await crepe.create();
	});

	onDestroy(() => {
		crepe?.destroy();
	});

	function syncMarkdown() {
		if (crepe) markdown = crepe.getMarkdown();
	}
</script>

<form
	method="POST"
	action={saveAction}
	use:enhance
	onsubmit={syncMarkdown}
	class="flex flex-col gap-3"
>
	<div
		bind:this={editorEl}
		class="lesson-plan-editor min-h-[60vh] w-full rounded-card border border-line bg-white"
	></div>
	<input type="hidden" name="plan" bind:value={markdown} />
	<div class="flex justify-end">
		<Button type="submit">Save plan</Button>
	</div>
</form>

<style>
	/* Let the editor use the full available width and trim Crepe's wide block-handle
	   gutter so text and handles sit close to the left edge. */
	.lesson-plan-editor :global(.milkdown) {
		width: 100%;
	}
	.lesson-plan-editor :global(.milkdown .ProseMirror) {
		padding: 1.5rem 1.5rem 1.5rem 3.25rem;
	}
</style>
