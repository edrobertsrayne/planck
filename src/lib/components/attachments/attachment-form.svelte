<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import Label from '$lib/components/ui/label/label.svelte';
	import * as RadioGroup from '$lib/components/ui/radio-group';

	let {
		entityType,
		entityId,
		onSuccess,
		onError
	}: {
		entityType: string;
		entityId: string;
		onSuccess: () => void;
		onError: (message: string) => void;
	} = $props();

	let attachmentType: 'file' | 'link' = $state('file');
	let fileInput: HTMLInputElement | undefined = $state(undefined);
	let linkUrl = $state('');
	let linkTitle = $state('');
	let uploading = $state(false);

	async function handleSubmit(e: Event) {
		e.preventDefault();
		uploading = true;

		try {
			const formData = new FormData();
			formData.append('entityType', entityType);
			formData.append('entityId', entityId);
			formData.append('type', attachmentType);

			if (attachmentType === 'file') {
				if (!fileInput?.files?.[0]) {
					onError('Please select a file');
					uploading = false;
					return;
				}
				formData.append('file', fileInput.files[0]);
			} else {
				if (!linkUrl || !linkTitle) {
					onError('Please provide both URL and title');
					uploading = false;
					return;
				}
				formData.append('url', linkUrl);
				formData.append('title', linkTitle);
			}

			const response = await fetch('/api/attachments', {
				method: 'POST',
				body: formData
			});

			if (!response.ok) {
				const error = await response.text();
				onError(error || 'Failed to upload attachment');
				uploading = false;
				return;
			}

			// Reset form
			if (fileInput) fileInput.value = '';
			linkUrl = '';
			linkTitle = '';

			onSuccess();
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			onError(message);
		} finally {
			uploading = false;
		}
	}
</script>

<div class="rounded-lg border border-border bg-background p-4">
	<h4 class="mb-4 text-sm font-medium">Add Attachment</h4>

	<form onsubmit={handleSubmit} class="space-y-4">
		<RadioGroup.Root bind:value={attachmentType}>
			<Label class="mb-2 block">Attachment Type</Label>
			<div class="flex gap-4">
				<div class="flex items-center gap-2">
					<RadioGroup.Item value="file" id="type-file" />
					<Label for="type-file" class="font-normal">File Upload</Label>
				</div>
				<div class="flex items-center gap-2">
					<RadioGroup.Item value="link" id="type-link" />
					<Label for="type-link" class="font-normal">Link</Label>
				</div>
			</div>
		</RadioGroup.Root>

		{#if attachmentType === 'file'}
			<div>
				<Label for="file">
					Choose File <span class="text-red-500">*</span>
				</Label>
				<input
					type="file"
					id="file"
					name="file"
					bind:this={fileInput}
					accept=".pdf,.docx,.pptx,.jpg,.jpeg,.png,.gif,.webp"
					required
					class="mt-2 block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary hover:file:bg-primary/20"
				/>
				<p class="mt-1 text-xs text-muted-foreground">
					Supported formats: PDF, DOCX, PPTX, Images (max 10MB)
				</p>
			</div>
		{:else}
			<div>
				<Label for="linkUrl">
					URL <span class="text-red-500">*</span>
				</Label>
				<Input
					type="url"
					id="linkUrl"
					name="linkUrl"
					bind:value={linkUrl}
					required
					placeholder="https://example.com"
					class="mt-2"
				/>
			</div>
			<div>
				<Label for="linkTitle">
					Title <span class="text-red-500">*</span>
				</Label>
				<Input
					type="text"
					id="linkTitle"
					name="linkTitle"
					bind:value={linkTitle}
					required
					placeholder="Link title"
					class="mt-2"
				/>
			</div>
		{/if}

		<div class="flex justify-end">
			<Button type="submit" disabled={uploading}>
				{uploading ? 'Uploading...' : 'Add Attachment'}
			</Button>
		</div>
	</form>
</div>
