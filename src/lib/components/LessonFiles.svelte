<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Button from './Button.svelte';
	import EmptyState from './EmptyState.svelte';
	import { validateFile } from '$lib/resources/files';

	type FileRow = {
		id: number;
		filename: string;
		blobUrl: string;
		contentType: string;
		size: number;
	};
	let {
		files,
		ownerType,
		ownerId
	}: { files: FileRow[]; ownerType: 'lesson' | 'scheduled'; ownerId: number } = $props();

	let uploading = $state(false);
	let errorMsg = $state('');

	async function onFileChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		errorMsg = '';

		const check = validateFile({ contentType: file.type, size: file.size });
		if (!check.ok) {
			errorMsg = check.error;
			input.value = '';
			return;
		}

		uploading = true;
		try {
			const { upload } = await import('@vercel/blob/client');
			const blob = await upload(file.name, file, {
				access: 'public',
				handleUploadUrl: '/api/lesson-files/upload',
				clientPayload: JSON.stringify({ ownerType, ownerId })
			});

			const body = new FormData();
			body.set('blobUrl', blob.url);
			body.set('pathname', blob.pathname);
			body.set('filename', file.name);
			body.set('contentType', blob.contentType || file.type);
			body.set('size', String(file.size));
			const res = await fetch('?/addFile', { method: 'POST', body });
			if (!res.ok) throw new Error('Failed to save file');
			await invalidateAll();
		} catch {
			errorMsg = 'Upload failed. Please try again.';
		} finally {
			uploading = false;
			input.value = '';
		}
	}
</script>

{#if files.length === 0}
	<EmptyState message="No files attached yet." />
{:else}
	<ul class="mb-4 flex flex-col gap-1.5">
		{#each files as file (file.id)}
			<li class="flex items-center gap-2 rounded-card border border-line bg-white px-4 py-2.5">
				<a
					href={file.blobUrl}
					target="_blank"
					rel="noopener noreferrer"
					class="flex-1 truncate text-pink-dk hover:underline"
				>
					{file.filename}
				</a>
				<span class="text-xs text-muted">{Math.round(file.size / 1024)} KB</span>
				<form method="POST" action="?/deleteFile" use:enhance>
					<input type="hidden" name="id" value={file.id} />
					<Button type="submit" variant="danger" size="sm">Remove</Button>
				</form>
			</li>
		{/each}
	</ul>
{/if}

<label class="inline-flex cursor-pointer items-center gap-2">
	<span
		class="rounded-control border border-line bg-field px-3 py-2 text-sm font-medium hover:border-pink-200"
	>
		{uploading ? 'Uploading…' : 'Upload file'}
	</span>
	<input type="file" class="sr-only" onchange={onFileChange} disabled={uploading} />
</label>
{#if errorMsg}
	<p class="mt-2 text-sm text-danger">{errorMsg}</p>
{/if}
