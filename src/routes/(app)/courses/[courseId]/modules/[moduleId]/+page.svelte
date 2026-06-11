<script lang="ts">
	import { enhance } from '$app/forms';
	let { data, form } = $props();

	function reorderedIds(index: number, dir: -1 | 1): string {
		const ids = data.lessons.map((l) => l.id);
		const target = index + dir;
		if (target < 0 || target >= ids.length) return ids.join(',');
		[ids[index], ids[target]] = [ids[target], ids[index]];
		return ids.join(',');
	}
</script>

<a href="/courses/{data.module.courseId}" class="text-sm text-blue-600">← Modules</a>
<h1 class="mb-4 text-2xl font-bold">{data.module.name}</h1>

<ul class="mb-6 flex flex-col gap-1">
	{#each data.lessons as l, i (l.id)}
		<li class="flex items-center gap-2">
			<form method="POST" action="?/reorder" use:enhance>
				<input type="hidden" name="orderedIds" value={reorderedIds(i, -1)} />
				<button class="px-1" disabled={i === 0} aria-label="Move up">↑</button>
			</form>
			<form method="POST" action="?/reorder" use:enhance>
				<input type="hidden" name="orderedIds" value={reorderedIds(i, 1)} />
				<button class="px-1" disabled={i === data.lessons.length - 1} aria-label="Move down">↓</button>
			</form>
			<span>{i + 1}. {l.title}</span>
			<form method="POST" action="?/delete" class="ml-auto">
				<input type="hidden" name="id" value={l.id} />
				<button class="text-sm text-red-600">Delete</button>
			</form>
		</li>
	{/each}
</ul>

<form method="POST" action="?/create" class="mb-8 flex items-end gap-2">
	<input name="title" placeholder="L1: Intro to forces" required class="rounded border p-1" />
	<button class="rounded bg-blue-600 p-1 px-3 text-white">Add lesson</button>
</form>

<section class="rounded border border-gray-200 p-4">
	<h2 class="mb-2 text-lg font-semibold">Schedule this module</h2>
	{#if data.classes.length === 0}
		<p class="text-sm text-gray-600">No classes study this course yet. Create one under Classes.</p>
	{:else}
		<form method="POST" action="?/assign" use:enhance class="flex items-end gap-2">
			<label
				>Class
				<select name="classId" class="ml-2 rounded border p-1">
					{#each data.classes as c (c.id)}
						<option value={c.id}>{c.name}</option>
					{/each}
				</select>
			</label>
			<button class="rounded bg-green-700 p-1 px-3 text-white">Assign</button>
		</form>
	{/if}

	{#if form?.assigned}
		<p class="mt-2 text-sm text-green-700">
			Scheduled {form.assigned.scheduled} lessons
			{#if form.assigned.firstDate}({form.assigned.firstDate} → {form.assigned.lastDate}){/if}.
			{#if form.assigned.unscheduled > 0}
				{form.assigned.unscheduled} did not fit before the end of your teaching blocks.
			{/if}
		</p>
	{/if}
	{#if form?.assignError}
		<p class="mt-2 text-sm text-red-600">{form.assignError}</p>
	{/if}
</section>
