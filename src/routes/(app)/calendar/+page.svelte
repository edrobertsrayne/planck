<script lang="ts">
	import { addDays } from '$lib/scheduling/dates';
	import { withAlpha } from '$lib/colour';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Chip from '$lib/components/Chip.svelte';
	let { data } = $props();

	const days = $derived(
		[
			{ n: 1, label: 'Mon' },
			{ n: 2, label: 'Tue' },
			{ n: 3, label: 'Wed' },
			{ n: 4, label: 'Thu' },
			{ n: 5, label: 'Fri' }
		].filter((d) =>
			data.config.teachingDays.includes(d.n as import('$lib/scheduling/dates').DayOfWeek)
		)
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

	const navLink =
		'rounded-control border border-pink-200 bg-white px-3 py-1.5 text-xs font-semibold text-pink-dk transition hover:bg-pink-50';
</script>

<PageHeader title="Calendar">
	{#snippet meta()}
		{#if data.weekLetter}<Chip>Week {data.weekLetter}</Chip>{/if}
	{/snippet}
	{#snippet actions()}
		<a class={navLink} href="?start={data.prevStart}">← Prev</a>
		<a class={navLink} href="?start={data.nextStart}">Next →</a>
	{/snippet}
</PageHeader>

<div class="overflow-hidden rounded-card border border-line">
	<table class="w-full border-collapse text-sm">
		<thead>
			<tr>
				<th class="w-12 border-b border-line bg-field p-3"></th>
				{#each days as d (d.n)}
					<th class="border-b border-l border-line bg-field p-3 text-xs font-bold text-ink/70">
						{d.label}<br /><span class="font-normal text-muted">{fmt(dateFor(d.n))}</span>
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each periods as p (p)}
				<tr>
					<th class="border-b border-line bg-field p-3 text-xs font-bold text-muted">P{p}</th>
					{#each days as d (d.n)}
						{@const l = cell(d.n, p)}
						<td class="h-20 border-b border-l border-line p-1.5 align-top">
							{#if l}
								<div
									class="flex h-full flex-col gap-1.5 rounded-lg p-2.5"
									style="background:{withAlpha(l.colour, 0.16)}"
								>
									<div class="text-xs font-bold">{l.className}</div>
									<div class="text-[11px] leading-tight text-ink/75">{l.title}</div>
									<div class="mt-auto text-[10px] font-semibold text-muted">{l.room}</div>
								</div>
							{:else}
								<div class="pt-6 text-center text-pink-200">·</div>
							{/if}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>
