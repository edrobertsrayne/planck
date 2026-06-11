<script lang="ts">
	import { addDays } from '$lib/scheduling/dates';
	let { data } = $props();

	const days = $derived(
		[
			{ n: 1, label: 'Mon' },
			{ n: 2, label: 'Tue' },
			{ n: 3, label: 'Wed' },
			{ n: 4, label: 'Thu' },
			{ n: 5, label: 'Fri' }
		].filter((d) => data.config.teachingDays.includes(d.n as import('$lib/scheduling/dates').DayOfWeek))
	);
	const periods = $derived(Array.from({ length: data.config.periodsPerDay }, (_, i) => i + 1));

	function dateFor(dayN: number): string {
		return addDays(data.weekStart, dayN - 1);
	}
	function cell(dayN: number, period: number) {
		const date = dateFor(dayN);
		return data.lessons.find((l) => l.date === date && l.period === period);
	}
	const dayFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
	function fmt(d: string) {
		return dayFmt.format(new Date(`${d}T00:00:00Z`));
	}
</script>

<div class="mb-3 flex items-center gap-3">
	<h1 class="text-2xl font-bold">Calendar</h1>
	{#if data.weekLetter}<span class="rounded bg-gray-200 px-2 py-0.5 text-sm">Week {data.weekLetter}</span>{/if}
	<a class="ml-auto rounded border px-2 py-1 text-sm" href="?start={data.prevStart}">← Prev</a>
	<a class="rounded border px-2 py-1 text-sm" href="?start={data.nextStart}">Next →</a>
</div>

<table class="w-full border-collapse">
	<thead>
		<tr>
			<th class="border p-2"></th>
			{#each days as d (d.n)}
				<th class="border p-2 text-sm">{d.label}<br /><span class="font-normal text-gray-500">{fmt(dateFor(d.n))}</span></th>
			{/each}
		</tr>
	</thead>
	<tbody>
		{#each periods as p (p)}
			<tr>
				<th class="border p-2">P{p}</th>
				{#each days as d (d.n)}
					{@const l = cell(d.n, p)}
					<td class="h-14 border p-1 align-top text-xs" style={l ? `background:${l.colour}22` : ''}>
						{#if l}
							<div class="font-bold">{l.className}</div>
							<div class="opacity-80">{l.title}</div>
							<div class="text-gray-500">{l.room}</div>
						{:else}
							<span class="text-gray-300">—</span>
						{/if}
					</td>
				{/each}
			</tr>
		{/each}
	</tbody>
</table>
