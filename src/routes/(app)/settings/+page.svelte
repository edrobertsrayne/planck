<script lang="ts">
	import type { DayOfWeek } from '$lib/scheduling/dates';

	let { data } = $props();
	const dayNames: { n: DayOfWeek; label: string }[] = [
		{ n: 1, label: 'Mon' },
		{ n: 2, label: 'Tue' },
		{ n: 3, label: 'Wed' },
		{ n: 4, label: 'Thu' },
		{ n: 5, label: 'Fri' }
	];
</script>

<h1 class="mb-4 text-2xl font-bold">Settings</h1>

<section class="mb-8">
	<h2 class="mb-2 text-lg font-semibold">Timetable</h2>
	<form method="POST" action="?/saveConfig" class="flex flex-col gap-3">
		<label
			>Cycle length
			<select name="cycleWeeks" class="ml-2 rounded border p-1">
				<option value="1" selected={data.config.cycleWeeks === 1}>1 week</option>
				<option value="2" selected={data.config.cycleWeeks === 2}>2 weeks</option>
			</select>
		</label>
		<label
			>Periods per day
			<input
				name="periodsPerDay"
				type="number"
				min="1"
				max="10"
				value={data.config.periodsPerDay}
				class="ml-2 w-16 rounded border p-1"
			/>
		</label>
		<label
			>First teaching week is
			<select name="anchorLetter" class="ml-2 rounded border p-1">
				<option value="A" selected={data.config.anchorLetter === 'A'}>Week A</option>
				<option value="B" selected={data.config.anchorLetter === 'B'}>Week B</option>
			</select>
		</label>
		<fieldset class="flex gap-3">
			<legend class="font-medium">Teaching days</legend>
			{#each dayNames as d (d.n)}
				<label class="flex items-center gap-1">
					<input
						type="checkbox"
						name="teachingDays"
						value={d.n}
						checked={data.config.teachingDays.includes(d.n)}
					/>
					{d.label}
				</label>
			{/each}
		</fieldset>
		<button class="w-32 rounded bg-blue-600 p-2 text-white">Save</button>
	</form>
</section>

<section class="mb-8">
	<h2 class="mb-2 text-lg font-semibold">Teaching blocks</h2>
	<ul class="mb-2">
		{#each data.blocks as b (b.id)}
			<li class="flex items-center gap-3 py-1">
				<span class="font-medium">{b.name}</span>
				<span class="text-sm text-gray-600">{b.startDate} → {b.endDate}</span>
				<form method="POST" action="?/deleteBlock">
					<input type="hidden" name="id" value={b.id} />
					<button class="text-sm text-red-600">Delete</button>
				</form>
			</li>
		{/each}
	</ul>
	<form method="POST" action="?/addBlock" class="flex items-end gap-2">
		<input name="name" placeholder="Autumn 1" required class="rounded border p-1" />
		<input name="startDate" type="date" required class="rounded border p-1" />
		<input name="endDate" type="date" required class="rounded border p-1" />
		<button class="rounded bg-gray-800 p-1 px-3 text-white">Add block</button>
	</form>
</section>

<section>
	<h2 class="mb-2 text-lg font-semibold">Closure days (INSET / bank holidays)</h2>
	<ul class="mb-2">
		{#each data.closures as c (c.id)}
			<li class="flex items-center gap-3 py-1">
				<span>{c.date}</span>
				<form method="POST" action="?/deleteClosure">
					<input type="hidden" name="id" value={c.id} />
					<button class="text-sm text-red-600">Delete</button>
				</form>
			</li>
		{/each}
	</ul>
	<form method="POST" action="?/addClosure" class="flex items-end gap-2">
		<input name="date" type="date" required class="rounded border p-1" />
		<button class="rounded bg-gray-800 p-1 px-3 text-white">Add closure</button>
	</form>
</section>
