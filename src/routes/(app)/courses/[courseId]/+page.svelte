<script lang="ts">
	import { enhance } from '$app/forms';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import ResourceLinks from '$lib/components/ResourceLinks.svelte';
	import ResourceFiles from '$lib/components/ResourceFiles.svelte';
	let { data } = $props();

	function reorderedIds(index: number, dir: -1 | 1): string {
		const ids = data.modules.map((m) => m.id);
		const target = index + dir;
		if (target < 0 || target >= ids.length) return ids.join(',');
		[ids[index], ids[target]] = [ids[target], ids[index]];
		return ids.join(',');
	}
</script>

<a href="/courses" class="text-sm font-medium text-pink-dk hover:underline">← Courses</a>
<PageHeader title={data.course.name} />

{#if data.modules.length === 0}
	<EmptyState message="No modules yet. Add the first one below." />
{:else}
	<ul class="mb-6 flex flex-col gap-1.5">
		{#each data.modules as m, i (m.id)}
			<li class="flex items-center gap-2 rounded-card border border-line bg-white px-4 py-2.5">
				<form method="POST" action="?/reorder" use:enhance>
					<input type="hidden" name="orderedIds" value={reorderedIds(i, -1)} />
					<button
						class="px-1 text-muted hover:text-ink disabled:opacity-30"
						disabled={i === 0}
						aria-label="Move up">↑</button
					>
				</form>
				<form method="POST" action="?/reorder" use:enhance>
					<input type="hidden" name="orderedIds" value={reorderedIds(i, 1)} />
					<button
						class="px-1 text-muted hover:text-ink disabled:opacity-30"
						disabled={i === data.modules.length - 1}
						aria-label="Move down">↓</button
					>
				</form>
				<a
					class="font-semibold text-ink hover:text-pink-dk hover:underline"
					href="/courses/{data.course.id}/modules/{m.id}">{m.name}</a
				>
				<form method="POST" action="?/delete" class="ml-auto">
					<input type="hidden" name="id" value={m.id} />
					<Button type="submit" variant="danger" size="sm">Delete</Button>
				</form>
			</li>
		{/each}
	</ul>
{/if}

<Card>
	<form method="POST" action="?/create" class="flex items-end gap-3">
		<input
			name="name"
			placeholder="Forces"
			required
			class="rounded-control border border-line bg-field px-3 py-2 text-sm"
		/>
		<Button type="submit">Add module</Button>
	</form>
</Card>

<Card class="mt-8 mb-6">
	<h2 class="mb-3 font-display text-lg font-semibold">Links</h2>
	<ResourceLinks links={data.links} />
</Card>

<Card>
	<h2 class="mb-3 font-display text-lg font-semibold">Files</h2>
	<ResourceFiles files={data.files} ownerType="course" ownerId={data.course.id} />
</Card>
