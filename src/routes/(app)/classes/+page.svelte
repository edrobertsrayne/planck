<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import SubjectDot from '$lib/components/SubjectDot.svelte';
	let { data } = $props();
</script>

<PageHeader title="Classes" subtitle="Teaching groups, each linked to a course." />

{#if data.classes.length === 0}
	<EmptyState message="No classes yet." />
{:else}
	<ul class="mb-6 flex flex-col gap-2">
		{#each data.classes as c (c.id)}
			<li class="flex items-center gap-3 rounded-card border border-line bg-white px-4 py-3">
				<SubjectDot colour={c.colour} />
				<a href="/classes/{c.id}" class="font-semibold text-ink hover:text-pink-dk hover:underline"
					>{c.name}</a
				>
				<span class="text-sm text-muted">{c.courseName}</span>
				<form method="POST" action="?/delete" class="ml-auto">
					<input type="hidden" name="id" value={c.id} />
					<Button type="submit" variant="danger" size="sm">Delete</Button>
				</form>
			</li>
		{/each}
	</ul>
{/if}

{#if data.courses.length === 0}
	<p class="text-sm text-muted">Create a course first.</p>
{:else}
	<Card>
		<form method="POST" action="?/create" class="flex flex-wrap items-end gap-3">
			<input
				name="name"
				placeholder="10Phy1"
				required
				class="rounded-control border border-line bg-field px-3 py-2 text-sm"
			/>
			<select name="courseId" class="rounded-control border border-line bg-field px-3 py-2 text-sm">
				{#each data.courses as course (course.id)}
					<option value={course.id}>{course.name}</option>
				{/each}
			</select>
			<Button type="submit">Add class</Button>
		</form>
	</Card>
{/if}
