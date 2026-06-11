<script lang="ts">
	import { enhance } from '$app/forms';
	let { data, form } = $props<{ data: import('./$types').PageData; form: { moveError?: string } | null }>();

	const dayFmt = new Intl.DateTimeFormat('en-GB', {
		weekday: 'short',
		day: 'numeric',
		month: 'short'
	});
	function label(d: string) {
		return dayFmt.format(new Date(`${d}T00:00:00Z`));
	}
</script>

<h1 class="mb-4 text-2xl font-bold">Agenda</h1>

{#if form?.moveError}<p class="mb-2 text-sm text-red-600">{form.moveError}</p>{/if}

{#if data.groups.length === 0}
	<p class="text-gray-600">No upcoming lessons. Assign a module to a class to fill your agenda.</p>
{/if}

{#each data.groups as g (g.date)}
	<h2 class="mt-5 mb-1 border-b pb-1 font-semibold">
		{label(g.date)}
		{#if g.weekLetter}<span class="text-sm font-normal text-gray-500">· Week {g.weekLetter}</span>{/if}
	</h2>
	{#each g.items as item (item.id)}
		<div class="flex items-center gap-3 border-b border-dashed py-1.5 text-sm">
			<span class="w-8 font-bold text-gray-500">P{item.period}</span>
			<span class="inline-block h-3 w-3 rounded" style="background:{item.colour}"></span>
			<span class="w-16 font-bold">{item.className}</span>
			<span class="flex-1">{item.courseName} — {item.title}</span>
			<span class="text-gray-500">{item.room}</span>
			<div class="flex items-center gap-1">
				<form method="POST" action="/agenda?/moveLesson" use:enhance class="flex items-center gap-1">
					<input type="hidden" name="id" value={item.id} />
					<input type="date" name="date" required class="rounded border text-xs" />
					<input type="number" name="period" min="1" placeholder="P" required class="w-12 rounded border text-xs" />
					<button class="text-xs text-blue-600">Move</button>
				</form>
				<form method="POST" action="/agenda?/deleteLesson" use:enhance>
					<input type="hidden" name="id" value={item.id} />
					<button class="text-xs text-red-600">Delete</button>
				</form>
			</div>
		</div>
	{/each}
{/each}
