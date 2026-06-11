<script lang="ts">
	import { enhance } from '$app/forms';
	let { data } = $props();

	function reorderedIds(index: number, dir: -1 | 1): string {
		const ids = data.modules.map((m) => m.id);
		const target = index + dir;
		if (target < 0 || target >= ids.length) return ids.join(',');
		[ids[index], ids[target]] = [ids[target], ids[index]];
		return ids.join(',');
	}
</script>

<a href="/courses" class="text-sm text-blue-600">← Courses</a>
<h1 class="mb-4 text-2xl font-bold">{data.course.name}</h1>

<ul class="mb-6 flex flex-col gap-1">
	{#each data.modules as m, i (m.id)}
		<li class="flex items-center gap-2">
			<form method="POST" action="?/reorder" use:enhance>
				<input type="hidden" name="orderedIds" value={reorderedIds(i, -1)} />
				<button class="px-1" disabled={i === 0} aria-label="Move up">↑</button>
			</form>
			<form method="POST" action="?/reorder" use:enhance>
				<input type="hidden" name="orderedIds" value={reorderedIds(i, 1)} />
				<button class="px-1" disabled={i === data.modules.length - 1} aria-label="Move down">↓</button>
			</form>
			<a class="font-medium text-blue-700 hover:underline" href="/courses/{data.course.id}/modules/{m.id}">
				{m.name}
			</a>
			<form method="POST" action="?/delete" class="ml-auto">
				<input type="hidden" name="id" value={m.id} />
				<button class="text-sm text-red-600">Delete</button>
			</form>
		</li>
	{/each}
</ul>

<form method="POST" action="?/create" class="flex items-end gap-2">
	<input name="name" placeholder="Forces" required class="rounded border p-1" />
	<button class="rounded bg-blue-600 p-1 px-3 text-white">Add module</button>
</form>
