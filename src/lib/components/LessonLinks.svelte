<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from './Button.svelte';
	import Field from './Field.svelte';
	import EmptyState from './EmptyState.svelte';

	type Link = { id: number; url: string; label: string | null };
	let { links }: { links: Link[] } = $props();
</script>

{#if links.length === 0}
	<EmptyState message="No links attached yet." />
{:else}
	<ul class="mb-4 flex flex-col gap-1.5">
		{#each links as link (link.id)}
			<li class="flex items-center gap-2 rounded-card border border-line bg-white px-4 py-2.5">
				<a
					href={link.url}
					target="_blank"
					rel="noopener noreferrer"
					class="flex-1 truncate text-pink-dk hover:underline"
				>
					{link.label ?? link.url}
				</a>
				<form method="POST" action="?/deleteLink" use:enhance>
					<input type="hidden" name="id" value={link.id} />
					<Button type="submit" variant="danger" size="sm">Remove</Button>
				</form>
			</li>
		{/each}
	</ul>
{/if}

<form method="POST" action="?/addLink" use:enhance class="flex items-end gap-3">
	<Field label="URL">
		<input
			name="url"
			type="url"
			required
			placeholder="https://…"
			class="w-72 rounded-control border border-line bg-field px-3 py-2 text-sm"
		/>
	</Field>
	<Field label="Label (optional)">
		<input
			name="label"
			placeholder="Intro video"
			class="rounded-control border border-line bg-field px-3 py-2 text-sm"
		/>
	</Field>
	<Button type="submit">Add link</Button>
</form>
