<script lang="ts">
	import type { DayOfWeek } from '$lib/scheduling/dates';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import Field from '$lib/components/Field.svelte';

	let { data } = $props();
	const dayNames: { n: DayOfWeek; label: string }[] = [
		{ n: 1, label: 'Mon' },
		{ n: 2, label: 'Tue' },
		{ n: 3, label: 'Wed' },
		{ n: 4, label: 'Thu' },
		{ n: 5, label: 'Fri' }
	];
	const selectClass = 'rounded-control border border-line bg-field px-3 py-2 text-sm';
	const inputClass = 'rounded-control border border-line bg-field px-3 py-2 text-sm';
</script>

<PageHeader title="Settings" />

<Card class="mb-6">
	<h2 class="mb-4 font-display text-lg font-semibold">Timetable</h2>
	<form method="POST" action="?/saveConfig" class="flex flex-col gap-4">
		<Field label="Cycle length">
			<select name="cycleWeeks" class={selectClass}>
				<option value="1" selected={data.config.cycleWeeks === 1}>1 week</option>
				<option value="2" selected={data.config.cycleWeeks === 2}>2 weeks</option>
			</select>
		</Field>
		<Field label="Periods per day">
			<input
				name="periodsPerDay"
				type="number"
				min="1"
				max="10"
				value={data.config.periodsPerDay}
				class={`${inputClass} w-24`}
			/>
		</Field>
		<Field label="First teaching week is">
			<select name="anchorLetter" class={selectClass}>
				<option value="A" selected={data.config.anchorLetter === 'A'}>Week A</option>
				<option value="B" selected={data.config.anchorLetter === 'B'}>Week B</option>
			</select>
		</Field>
		<fieldset>
			<legend class="mb-2 text-sm font-medium text-ink">Teaching days</legend>
			<div class="flex flex-wrap gap-3">
				{#each dayNames as d (d.n)}
					<label class="flex items-center gap-1.5 text-sm">
						<input
							type="checkbox"
							name="teachingDays"
							value={d.n}
							checked={data.config.teachingDays.includes(d.n)}
						/>
						{d.label}
					</label>
				{/each}
			</div>
		</fieldset>
		<Button type="submit" class="w-32">Save</Button>
	</form>
</Card>

<Card class="mb-6">
	<h2 class="mb-4 font-display text-lg font-semibold">Teaching blocks</h2>
	<ul class="mb-3 flex flex-col gap-1">
		{#each data.blocks as b (b.id)}
			<li class="flex items-center gap-3 py-1">
				<span class="font-semibold text-ink">{b.name}</span>
				<span class="text-sm text-muted">{b.startDate} → {b.endDate}</span>
				<form method="POST" action="?/deleteBlock" class="ml-auto">
					<input type="hidden" name="id" value={b.id} />
					<Button type="submit" variant="danger" size="sm">Delete</Button>
				</form>
			</li>
		{/each}
	</ul>
	<form method="POST" action="?/addBlock" class="flex flex-wrap items-end gap-3">
		<input name="name" placeholder="Autumn 1" required class={inputClass} />
		<input name="startDate" type="date" required class={inputClass} />
		<input name="endDate" type="date" required class={inputClass} />
		<Button type="submit" variant="secondary">Add block</Button>
	</form>
</Card>

<Card>
	<h2 class="mb-4 font-display text-lg font-semibold">Closure days (INSET / bank holidays)</h2>
	<ul class="mb-3 flex flex-col gap-1">
		{#each data.closures as c (c.id)}
			<li class="flex items-center gap-3 py-1">
				<span class="text-ink">{c.date}</span>
				<form method="POST" action="?/deleteClosure" class="ml-auto">
					<input type="hidden" name="id" value={c.id} />
					<Button type="submit" variant="danger" size="sm">Delete</Button>
				</form>
			</li>
		{/each}
	</ul>
	<form method="POST" action="?/addClosure" class="flex flex-wrap items-end gap-3">
		<input name="date" type="date" required class={inputClass} />
		<Button type="submit" variant="secondary">Add closure</Button>
	</form>
</Card>
