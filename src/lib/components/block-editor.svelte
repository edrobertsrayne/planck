<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	interface Props {
		data?: string | null;
		placeholder?: string;
		name?: string;
		class?: string;
		onSave?: (json: string) => void;
	}

	let {
		data = $bindable(null),
		placeholder = 'Start writing...',
		name = 'content',
		class: className = '',
		onSave
	}: Props = $props();

	let editorHolder: HTMLDivElement | undefined = $state();
	let editorInstance: InstanceType<typeof import('@editorjs/editorjs').default> | null = null;
	let hiddenValue = $state(data ?? '');
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	onMount(() => {
		if (!browser || !editorHolder) return;

		let destroyed = false;

		async function initEditor() {
			const [
				{ default: EditorJS },
				{ default: Header },
				{ default: EditorjsList },
				{ default: Checklist },
				{ default: Quote },
				{ default: Code },
				{ default: Delimiter },
				{ default: Marker },
				{ default: InlineCode },
				{ default: Table }
			] = await Promise.all([
				import('@editorjs/editorjs'),
				import('@editorjs/header'),
				import('@editorjs/list'),
				import('@editorjs/checklist'),
				import('@editorjs/quote'),
				import('@editorjs/code'),
				import('@editorjs/delimiter'),
				import('@editorjs/marker'),
				import('@editorjs/inline-code'),
				import('@editorjs/table')
			]);

			if (destroyed) return;

			let initialData: import('@editorjs/editorjs').OutputData | undefined;
			if (data) {
				try {
					initialData = JSON.parse(data) as import('@editorjs/editorjs').OutputData;
				} catch {
					// Invalid JSON, start fresh
				}
			}

			const editor = new EditorJS({
				holder: editorHolder!,
				placeholder,
				data: initialData,
				tools: {
					header: {
						class: Header as unknown as import('@editorjs/editorjs').ToolConstructable,
						config: { levels: [2, 3, 4], defaultLevel: 2 }
					},
					list: {
						class: EditorjsList as unknown as import('@editorjs/editorjs').ToolConstructable,
						inlineToolbar: true
					},
					checklist: {
						class: Checklist as unknown as import('@editorjs/editorjs').ToolConstructable,
						inlineToolbar: true
					},
					quote: {
						class: Quote as unknown as import('@editorjs/editorjs').ToolConstructable,
						inlineToolbar: true
					},
					code: Code as unknown as import('@editorjs/editorjs').ToolConstructable,
					delimiter: Delimiter as unknown as import('@editorjs/editorjs').ToolConstructable,
					marker: {
						class: Marker as unknown as import('@editorjs/editorjs').ToolConstructable,
						shortcut: 'CMD+SHIFT+M'
					},
					inlineCode: {
						class: InlineCode as unknown as import('@editorjs/editorjs').ToolConstructable,
						shortcut: 'CMD+SHIFT+C'
					},
					table: {
						class: Table as unknown as import('@editorjs/editorjs').ToolConstructable,
						inlineToolbar: true
					}
				},
				onChange: () => {
					if (debounceTimer) clearTimeout(debounceTimer);
					debounceTimer = setTimeout(async () => {
						if (!editorInstance || destroyed) return;
						try {
							const output = await editorInstance.save();
							const json = JSON.stringify(output);
							hiddenValue = json;
							data = json;
							onSave?.(json);
						} catch {
							// Save failed, ignore
						}
					}, 1000);
				}
			});

			await editor.isReady;
			if (destroyed) {
				editor.destroy();
				return;
			}
			editorInstance = editor;
		}

		initEditor();

		return () => {
			destroyed = true;
			if (debounceTimer) clearTimeout(debounceTimer);
			if (editorInstance) {
				editorInstance.destroy();
				editorInstance = null;
			}
		};
	});

	export async function save(): Promise<string | null> {
		if (!editorInstance) return null;
		try {
			const output = await editorInstance.save();
			const json = JSON.stringify(output);
			hiddenValue = json;
			data = json;
			return json;
		} catch {
			return null;
		}
	}
</script>

<div class="block-editor rounded-md border border-input bg-background {className}">
	<div bind:this={editorHolder} class="min-h-[120px] px-4 py-2"></div>
</div>
<input type="hidden" {name} value={hiddenValue} />

<style>
	:global(.block-editor .ce-block__content) {
		max-width: 100%;
	}
	:global(.block-editor .ce-toolbar__content) {
		max-width: 100%;
	}
	:global(.block-editor .codex-editor__redactor) {
		padding-bottom: 60px !important;
	}
</style>
