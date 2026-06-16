<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from './Button.svelte';
	import Field from './Field.svelte';
	import EmptyState from './EmptyState.svelte';
	import ResourceRow from './ResourceRow.svelte';
	import { linkMeta, LINK_TILE, LINK_ICON } from '$lib/resources/meta';

	type Link = { id: number; url: string; label: string | null };
	let { links }: { links: Link[] } = $props();
</script>

{#if links.length === 0}
	<EmptyState message="No links attached yet." />
{:else}
	<ul class="mb-4 flex flex-col gap-1.5">
		{#each links as link (link.id)}
			{@const m = linkMeta(link.url)}
			<li>
				<ResourceRow
					tileBg={LINK_TILE[m.type].bg}
					tileFg={LINK_TILE[m.type].fg}
					iconSvg={LINK_ICON[m.type]}
					title={link.label ?? m.host}
					meta={link.url}
					href={link.url}
					deleteAction="?/deleteLink"
					id={link.id}
				/>
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
