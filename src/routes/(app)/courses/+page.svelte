<script lang="ts">
	let { data } = $props();
</script>

<h1 class="mb-4 text-2xl font-bold">Courses</h1>

<ul class="mb-6 flex flex-col gap-2">
	{#each data.courses as c (c.id)}
		<li class="flex items-center gap-3">
			<span class="inline-block h-4 w-4 rounded" style="background:{c.colour}"></span>
			<a class="font-medium text-blue-700 hover:underline" href="/courses/{c.id}">{c.name}</a>
			<form method="POST" action="?/delete" class="ml-auto">
				<input type="hidden" name="id" value={c.id} />
				<button class="text-sm text-red-600">Delete</button>
			</form>
		</li>
	{/each}
</ul>

<form method="POST" action="?/create" class="flex items-end gap-2">
	<input name="name" placeholder="GCSE Chemistry" required class="rounded border p-1" />
	<input name="colour" type="color" value="#3884ff" class="h-8 w-10 rounded border" />
	<button class="rounded bg-blue-600 p-1 px-3 text-white">Add course</button>
</form>
