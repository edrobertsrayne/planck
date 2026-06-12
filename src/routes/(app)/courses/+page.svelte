<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import SubjectDot from '$lib/components/SubjectDot.svelte';
	let { data } = $props();
</script>

<PageHeader title="Courses" subtitle="Your subjects and their schemes of work." />

{#if data.courses.length === 0}
	<EmptyState message="No courses yet. Add your first below." />
{:else}
	<ul class="mb-6 flex flex-col gap-2">
		{#each data.courses as c (c.id)}
			<li class="flex items-center gap-3 rounded-card border border-line bg-white px-4 py-3">
				<SubjectDot colour={c.colour} />
				<a class="font-semibold text-ink hover:text-pink-dk hover:underline" href="/courses/{c.id}"
					>{c.name}</a
				>
				<form method="POST" action="?/delete" class="ml-auto">
					<input type="hidden" name="id" value={c.id} />
					<Button type="submit" variant="danger" size="sm">Delete</Button>
				</form>
			</li>
		{/each}
	</ul>
{/if}

<Card>
	<form method="POST" action="?/create" class="flex flex-wrap items-end gap-3">
		<input
			name="name"
			placeholder="GCSE Chemistry"
			required
			class="rounded-control border border-line bg-field px-3 py-2 text-sm"
		/>
		<input name="colour" type="color" value="#3884ff" class="h-9 w-12 rounded-control border border-line" />
		<Button type="submit">Add course</Button>
	</form>
</Card>
