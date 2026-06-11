<script lang="ts">
	let { data } = $props();
</script>

<h1 class="mb-4 text-2xl font-bold">Classes</h1>

<ul class="mb-6 flex flex-col gap-2">
	{#each data.classes as c (c.id)}
		<li class="flex items-center gap-3">
			<span class="inline-block h-4 w-4 rounded" style="background:{c.colour}"></span>
			<span class="font-medium">{c.name}</span>
			<span class="text-sm text-gray-600">{c.courseName}</span>
			<form method="POST" action="?/delete" class="ml-auto">
				<input type="hidden" name="id" value={c.id} />
				<button class="text-sm text-red-600">Delete</button>
			</form>
		</li>
	{/each}
</ul>

{#if data.courses.length === 0}
	<p class="text-sm text-gray-600">Create a course first.</p>
{:else}
	<form method="POST" action="?/create" class="flex items-end gap-2">
		<input name="name" placeholder="10Phy1" required class="rounded border p-1" />
		<select name="courseId" class="rounded border p-1">
			{#each data.courses as course (course.id)}
				<option value={course.id}>{course.name}</option>
			{/each}
		</select>
		<button class="rounded bg-blue-600 p-1 px-3 text-white">Add class</button>
	</form>
{/if}
