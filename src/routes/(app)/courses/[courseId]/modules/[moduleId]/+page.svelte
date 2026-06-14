<script lang="ts">
	import { enhance } from '$app/forms';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import Field from '$lib/components/Field.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	let { data, form } = $props();

	function reorderedIds(index: number, dir: -1 | 1): string {
		const ids = data.lessons.map((l) => l.id);
		const target = index + dir;
		if (target < 0 || target >= ids.length) return ids.join(',');
		[ids[index], ids[target]] = [ids[target], ids[index]];
		return ids.join(',');
	}
</script>

<a href="/courses/{data.module.courseId}" class="text-sm font-medium text-pink-dk hover:underline"
	>← Modules</a
>
<PageHeader title={data.module.name} />

{#if data.lessons.length === 0}
	<EmptyState message="No lessons in this module yet." />
{:else}
	<ul class="mb-6 flex flex-col gap-1.5">
		{#each data.lessons as l, i (l.id)}
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
						disabled={i === data.lessons.length - 1}
						aria-label="Move down">↓</button
					>
				</form>
				<a
					href="/courses/{data.module.courseId}/modules/{data.module.id}/lessons/{l.id}"
					class="text-ink hover:underline"
					><span class="font-semibold text-muted">{i + 1}.</span> {l.title}</a
				>
				<form method="POST" action="?/delete" class="ml-auto">
					<input type="hidden" name="id" value={l.id} />
					<Button type="submit" variant="danger" size="sm">Delete</Button>
				</form>
			</li>
		{/each}
	</ul>
{/if}

<Card class="mb-8">
	<form method="POST" action="?/create" class="flex items-end gap-3">
		<input
			name="title"
			placeholder="L1: Intro to forces"
			required
			class="rounded-control border border-line bg-field px-3 py-2 text-sm"
		/>
		<Button type="submit">Add lesson</Button>
	</form>
</Card>

<Card>
	<h2 class="mb-3 font-display text-lg font-semibold">Schedule this module</h2>
	{#if data.classes.length === 0}
		<p class="text-sm text-muted">No classes study this course yet. Create one under Classes.</p>
	{:else}
		<form method="POST" action="?/assign" use:enhance class="flex items-end gap-3">
			<Field label="Class">
				<select
					name="classId"
					class="rounded-control border border-line bg-field px-3 py-2 text-sm"
				>
					{#each data.classes as c (c.id)}
						<option value={c.id}>{c.name}</option>
					{/each}
				</select>
			</Field>
			<Button type="submit">Assign</Button>
		</form>
	{/if}

	{#if form?.assigned}
		<p class="mt-3 text-sm text-success">
			Scheduled {form.assigned.scheduled} lessons
			{#if form.assigned.firstDate}({form.assigned.firstDate} → {form.assigned.lastDate}){/if}.
			{#if form.assigned.unscheduled > 0}
				{form.assigned.unscheduled} did not fit before the end of your teaching blocks.
			{/if}
		</p>
	{/if}
	{#if form?.assignError}
		<p class="mt-3 text-sm text-danger">{form.assignError}</p>
	{/if}
</Card>
