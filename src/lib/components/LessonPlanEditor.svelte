<script lang="ts">
	import { onMount, onDestroy, untrack } from 'svelte';

	let { value = '', saveAction }: { value?: string; saveAction: string } = $props();

	type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error';

	let editorEl: HTMLDivElement;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let crepe: any = null;
	// The last value we know is persisted; edits matching it need no save.
	let savedValue = untrack(() => value);
	let ready = false;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let status = $state<SaveStatus>('saved');

	onMount(async () => {
		const { Crepe } = await import('@milkdown/crepe');
		await import('@milkdown/crepe/theme/common/style.css');
		await import('@milkdown/crepe/theme/frame.css');
		crepe = new Crepe({ root: editorEl, defaultValue: value });
		crepe.on(
			(listener: { markdownUpdated: (fn: (ctx: unknown, markdown: string) => void) => void }) => {
				listener.markdownUpdated((_ctx, markdown) => {
					if (!ready || markdown === savedValue) return;
					status = 'unsaved';
					clearTimeout(timer);
					timer = setTimeout(save, 1000);
				});
			}
		);
		await crepe.create();
		ready = true;
	});

	onDestroy(() => {
		clearTimeout(timer);
		// Persist any pending edits even if we're navigating away.
		if (crepe && status !== 'saved' && status !== 'saving') flush(crepe.getMarkdown());
		crepe?.destroy();
	});

	async function save() {
		clearTimeout(timer);
		if (!crepe) return;
		const markdown: string = crepe.getMarkdown();
		if (markdown === savedValue) {
			status = 'saved';
			return;
		}
		status = 'saving';
		try {
			const body = new FormData();
			body.set('plan', markdown);
			const res = await fetch(saveAction, { method: 'POST', body });
			if (!res.ok) throw new Error('save failed');
			savedValue = markdown;
			status = 'saved';
		} catch {
			status = 'error';
		}
	}

	// Fire-and-forget save that survives unmount/navigation.
	function flush(markdown: string) {
		const body = new FormData();
		body.set('plan', markdown);
		fetch(saveAction, { method: 'POST', body, keepalive: true }).catch(() => {});
	}

	const label = $derived(
		status === 'saving'
			? 'Saving…'
			: status === 'unsaved'
				? 'Unsaved changes'
				: status === 'error'
					? 'Save failed'
					: 'Saved'
	);
</script>

<div class="flex flex-col gap-2">
	<div
		bind:this={editorEl}
		onfocusout={save}
		class="lesson-plan-editor min-h-72 w-full rounded-card border border-line bg-white"
	></div>
	<p class="text-right text-xs {status === 'error' ? 'text-danger' : 'text-muted'}">{label}</p>
</div>

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
