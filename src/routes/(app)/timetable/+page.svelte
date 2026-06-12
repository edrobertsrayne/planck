<script lang="ts">
	import { enhance } from '$app/forms';
	import { withAlpha } from '$lib/colour';
	import PageHeader from '$lib/components/PageHeader.svelte';
	let { data } = $props();

	let week = $state<'A' | 'B'>('A');
	const days = $derived(
		[
			{ n: 1, label: 'Mon' },
			{ n: 2, label: 'Tue' },
			{ n: 3, label: 'Wed' },
			{ n: 4, label: 'Thu' },
			{ n: 5, label: 'Fri' }
		].filter((d) =>
			data.config.teachingDays.includes(d.n as (typeof data.config.teachingDays)[number])
		)
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

<PageHeader title="Timetable" subtitle='Pick a class to assign a cell; choose "— free —" to clear it.' />

{#if data.config.cycleWeeks === 2}
	<div class="mb-4 inline-flex gap-1 rounded-control border border-line bg-field p-1">
		<button
			class="rounded-md px-4 py-1.5 text-sm font-semibold transition"
			class:bg-white={week === 'A'}
			class:text-pink-dk={week === 'A'}
			class:text-muted={week !== 'A'}
			onclick={() => (week = 'A')}
		>
			Week A
		</button>
		<button
			class="rounded-md px-4 py-1.5 text-sm font-semibold transition"
			class:bg-white={week === 'B'}
			class:text-pink-dk={week === 'B'}
			class:text-muted={week !== 'B'}
			onclick={() => (week = 'B')}
		>
			Week B
		</button>
	</div>
{/if}

<div class="overflow-hidden rounded-card border border-line">
	<table class="border-collapse text-sm">
		<thead>
			<tr>
				<th class="border-b border-line bg-field p-3"></th>
				{#each days as d (d.n)}
					<th class="border-b border-l border-line bg-field p-3 text-xs font-bold text-ink/70"
						>{d.label}</th
					>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each periods as p (p)}
				<tr>
					<th class="border-b border-line bg-field p-3 text-xs font-bold text-muted">P{p}</th>
					{#each days as d (d.n)}
						{@const slot = slotFor(d.n, p)}
						{@const cls = slot ? classById(slot.classId) : undefined}
						<td class="border-b border-l border-line p-1.5 align-top">
							<form method="POST" action="?/set" use:enhance class="flex flex-col gap-1.5">
								<input type="hidden" name="weekLetter" value={week} />
								<input type="hidden" name="dayOfWeek" value={d.n} />
								<input type="hidden" name="period" value={p} />
								<select
									name="classId"
									class="w-28 rounded-control border border-line text-sm"
									style={cls ? `background:${withAlpha(cls.colour, 0.16)}` : ''}
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
									class="w-28 rounded-control border border-line bg-field text-sm"
									onblur={(e) => e.currentTarget.form?.requestSubmit()}
								/>
							</form>
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>
