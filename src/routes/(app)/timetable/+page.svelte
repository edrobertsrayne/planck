<script lang="ts">
	import { enhance } from '$app/forms';
	let { data } = $props();

	let week = $state<'A' | 'B'>('A');
	const days = $derived(
		[
			{ n: 1, label: 'Mon' },
			{ n: 2, label: 'Tue' },
			{ n: 3, label: 'Wed' },
			{ n: 4, label: 'Thu' },
			{ n: 5, label: 'Fri' }
		].filter((d) => data.config.teachingDays.includes(d.n as (typeof data.config.teachingDays)[number]))
	);
	const periods = $derived(Array.from({ length: data.config.periodsPerDay }, (_, i) => i + 1));

	function slotFor(dayOfWeek: number, period: number) {
		return data.slots.find(
			(s) => s.weekLetter === week && s.dayOfWeek === dayOfWeek && s.period === period
		);
	}
	function classById(id: number) {
		return data.classes.find((c) => c.id === id);
	}
</script>

<h1 class="mb-4 text-2xl font-bold">Timetable</h1>

{#if data.config.cycleWeeks === 2}
	<div class="mb-3 flex gap-2">
		<button class="rounded px-3 py-1" class:bg-gray-200={week === 'A'} onclick={() => (week = 'A')}>
			Week A
		</button>
		<button class="rounded px-3 py-1" class:bg-gray-200={week === 'B'} onclick={() => (week = 'B')}>
			Week B
		</button>
	</div>
{/if}

<table class="border-collapse">
	<thead>
		<tr>
			<th class="border p-2"></th>
			{#each days as d (d.n)}<th class="border p-2">{d.label}</th>{/each}
		</tr>
	</thead>
	<tbody>
		{#each periods as p (p)}
			<tr>
				<th class="border p-2">P{p}</th>
				{#each days as d (d.n)}
					{@const slot = slotFor(d.n, p)}
					{@const cls = slot ? classById(slot.classId) : undefined}
					<td class="border p-1 align-top">
						<form method="POST" action="?/set" use:enhance class="flex flex-col gap-1">
							<input type="hidden" name="weekLetter" value={week} />
							<input type="hidden" name="dayOfWeek" value={d.n} />
							<input type="hidden" name="period" value={p} />
							<select
								name="classId"
								class="w-28 rounded border text-sm"
								style={cls ? `background:${cls.colour}22` : ''}
								onchange={(e) => e.currentTarget.form?.requestSubmit()}
							>
								<option value="0">— free —</option>
								{#each data.classes as c (c.id)}
									<option value={c.id} selected={slot?.classId === c.id}>{c.name}</option>
								{/each}
							</select>
							<input
								name="room"
								placeholder="Room"
								value={slot?.room ?? ''}
								class="w-28 rounded border text-sm"
								onblur={(e) => e.currentTarget.form?.requestSubmit()}
							/>
						</form>
					</td>
				{/each}
			</tr>
		{/each}
	</tbody>
</table>
<p class="mt-2 text-sm text-gray-600">Pick a class to assign a cell; choose "— free —" to clear it.</p>
