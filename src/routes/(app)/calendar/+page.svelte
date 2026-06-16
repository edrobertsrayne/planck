<script lang="ts">
	import { addDays } from '$lib/scheduling/dates';
	import { subjectTint } from '$lib/colour';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Chip from '$lib/components/Chip.svelte';
	let { data } = $props();

	const days = $derived(
		[
			{ n: 1, label: 'Mon' },
			{ n: 2, label: 'Tue' },
			{ n: 3, label: 'Wed' },
			{ n: 4, label: 'Thu' },
			{ n: 5, label: 'Fri' },
			{ n: 6, label: 'Sat' },
			{ n: 7, label: 'Sun' }
		].filter((d) =>
			data.config.teachingDays.includes(d.n as import('$lib/scheduling/dates').DayOfWeek)
		)
	);
	const periods = $derived(Array.from({ length: data.config.periodsPerDay }, (_, i) => i + 1));
	const today = new Date().toISOString().slice(0, 10);

	function dateFor(dayN: number): string {
		return addDays(data.weekStart, dayN - 1);
	}
	function cell(dayN: number, period: number) {
		const date = dateFor(dayN);
		return data.lessons.find((l) => l.date === date && l.period === period);
	}
	const dayFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric' });
	function fmt(d: string) {
		return dayFmt.format(new Date(`${d}T00:00:00Z`));
	}
	const rangeFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' });
	const weekRange = $derived(`Week of ${rangeFmt.format(new Date(`${data.weekStart}T00:00:00Z`))}`);

	const legend = $derived(
		[...new Map(data.lessons.map((l) => [`${l.className}|${l.colour}`, l])).values()].map((l) => ({
			className: l.className,
			colour: l.colour
		}))
	);

	const navLink =
		'rounded-control border border-pink-200 bg-white px-3 py-1.5 text-xs font-semibold text-pink-dk transition hover:bg-pink-50';
</script>

<PageHeader title="Calendar" eyebrow={weekRange}>
	{#snippet meta()}
		{#if data.weekLetter}<Chip>Week {data.weekLetter}</Chip>{/if}
	{/snippet}
	{#snippet actions()}
		<a class={navLink} href="?start={data.prevStart}">← Prev</a>
		<a class={navLink} href="?start={data.nextStart}">Next →</a>
	{/snippet}
</PageHeader>

<div class="overflow-x-auto">
	<div class="min-w-[720px] rounded-card border border-line bg-white p-3.5 shadow-sm">
		<div class="flex gap-2.5 pb-3">
			<div class="w-14 shrink-0"></div>
			{#each days as d (d.n)}
				{@const date = dateFor(d.n)}
				<div class="flex-1 text-center">
					<div class="text-xs font-bold tracking-wide text-muted uppercase">{d.label}</div>
					<div
						class="mt-0.5 inline-flex h-[30px] w-[30px] items-center justify-center rounded-full text-[17px] font-bold"
						class:bg-pink={date === today}
						class:text-white={date === today}
						class:text-ink={date !== today}
					>
						{fmt(date)}
					</div>
				</div>
			{/each}
		</div>
		{#each periods as p (p)}
			<div class="mb-2.5 flex gap-2.5">
				<div class="flex w-14 shrink-0 flex-col items-center justify-center pt-1">
					<span class="text-[11px] font-bold text-muted">PERIOD</span>
					<span class="font-display text-2xl leading-none font-medium text-ink/80">{p}</span>
				</div>
				{#each days as d (d.n)}
					{@const l = cell(d.n, p)}
					{#if l}
						{@const t = subjectTint(l.colour)}
						<div
							class="h-[88px] flex-1 overflow-hidden rounded-xl p-2.5"
							style="background:{t.bg};border-left:3px solid {t.dot}"
						>
							<div class="mb-0.5 text-[13.5px] font-bold" style="color:{t.text}">
								{l.className}
							</div>
							<div class="text-xs opacity-90" style="color:{t.text}">{l.title}</div>
							<div class="mt-1 text-[11.5px] opacity-60" style="color:{t.text}">{l.room}</div>
						</div>
					{:else}
						<div
							class="flex h-[88px] flex-1 items-center justify-center rounded-xl border border-dashed border-line bg-field"
						>
							<span class="text-xs text-pink-200">Free</span>
						</div>
					{/if}
				{/each}
			</div>
		{/each}
	</div>

	<div class="mt-4.5 flex min-w-[720px] flex-wrap gap-4 px-1">
		{#each legend as s (s.className + s.colour)}
			<div class="flex items-center gap-2 text-[13px] text-muted">
				<span class="h-[11px] w-[11px] rounded-[4px]" style="background:{s.colour}"></span>
				{s.className}
			</div>
		{/each}
	</div>
</div>
