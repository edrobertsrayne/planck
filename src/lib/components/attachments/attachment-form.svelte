<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';

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

<div class="rounded-lg border border-gray-200 bg-white p-4">
	<h4 class="mb-4 text-sm font-medium text-gray-700">Add Attachment</h4>

	<form onsubmit={handleSubmit} class="space-y-4">
		<fieldset>
			<legend class="mb-2 block text-sm font-medium text-gray-700">Attachment Type</legend>
			<div class="flex gap-4">
				<label class="flex items-center gap-2">
					<input
						type="radio"
						name="attachmentType"
						value="file"
						bind:group={attachmentType}
						class="h-4 w-4 text-blue-600"
					/>
					<span class="text-sm">File Upload</span>
				</label>
				<label class="flex items-center gap-2">
					<input
						type="radio"
						name="attachmentType"
						value="link"
						bind:group={attachmentType}
						class="h-4 w-4 text-blue-600"
					/>
					<span class="text-sm">Link</span>
				</label>
			</div>
		</fieldset>

		{#if attachmentType === 'file'}
			<div>
				<label for="file" class="mb-2 block text-sm font-medium text-gray-700">
					Choose File <span class="text-red-500">*</span>
				</label>
				<input
					type="file"
					id="file"
					name="file"
					bind:this={fileInput}
					accept=".pdf,.docx,.pptx,.jpg,.jpeg,.png,.gif,.webp"
					required
					class="block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
				/>
				<p class="mt-1 text-xs text-gray-500">
					Supported formats: PDF, DOCX, PPTX, Images (max 10MB)
				</p>
			</div>
		{:else}
			<div>
				<label for="linkUrl" class="mb-2 block text-sm font-medium text-gray-700">
					URL <span class="text-red-500">*</span>
				</label>
				<input
					type="url"
					id="linkUrl"
					name="linkUrl"
					bind:value={linkUrl}
					required
					placeholder="https://example.com"
					class="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none"
				/>
			</div>
			<div>
				<label for="linkTitle" class="mb-2 block text-sm font-medium text-gray-700">
					Title <span class="text-red-500">*</span>
				</label>
				<input
					type="text"
					id="linkTitle"
					name="linkTitle"
					bind:value={linkTitle}
					required
					placeholder="Link title"
					class="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none"
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
