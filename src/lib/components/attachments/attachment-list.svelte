<script lang="ts">
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/button/button.svelte';
	import type { attachment } from '$lib/server/db/schema';

	type Attachment = typeof attachment.$inferSelect;

	let {
		attachments = [],
		onDelete,
		canEdit = true
	}: {
		attachments: Attachment[];
		onDelete: (id: string) => void;
		canEdit?: boolean;
	} = $props();

	function getIconForMimeType(mimeType: string | null): string {
		if (!mimeType) return '📄';
		if (mimeType.startsWith('image/')) return '🖼️';
		if (mimeType === 'application/pdf') return '📕';
		if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
			return '📄';
		}
		if (mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
			return '📊';
		}
		return '📎';
	}
</script>

{#if attachments.length > 0}
	<div class="space-y-2">
		<h4 class="text-sm font-medium text-gray-700">Attachments</h4>
		<ul class="space-y-2">
			{#each attachments as attachment (attachment.id)}
				<li
					class="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2"
				>
					<div class="flex items-center gap-2">
						<span class="text-xl">{getIconForMimeType(attachment.mimeType)}</span>
						{#if attachment.type === 'file'}
							<a
								href={resolve(`/api/attachments/${attachment.id}`)}
								class="text-sm text-blue-600 hover:underline"
								target="_blank"
								rel="noopener noreferrer"
							>
								{attachment.fileName}
							</a>
						{:else if attachment.type === 'link'}
							<!-- eslint-disable svelte/no-navigation-without-resolve -->
							<a
								href={attachment.url || '#'}
								class="text-sm text-blue-600 hover:underline"
								target="_blank"
								rel="noopener noreferrer"
							>
								{attachment.fileName}
							</a>
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
						{/if}
					</div>
					{#if canEdit}
						<Button variant="destructive" size="sm" onclick={() => onDelete(attachment.id)}>
							Delete
						</Button>
					{/if}
				</li>
			{/each}
		</ul>
	</div>
{:else}
	<p class="text-sm text-gray-500">No attachments</p>
{/if}
