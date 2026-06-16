<script lang="ts">
	import { enhance } from '$app/forms';
	import { subjectTint } from '$lib/colour';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl.svelte';
	import Menu from '$lib/components/Menu.svelte';
	let { data } = $props();

	let week = $state<'A' | 'B'>('A');
	let openKey = $state<string | null>(null);

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
	function keyFor(dayOfWeek: number, period: number) {
		return `${week}|${dayOfWeek}|${period}`;
	}
</script>

<PageHeader title="Timetable" eyebrow="Your weekly teaching schedule">
	{#snippet actions()}
		{#if data.config.cycleWeeks === 2}
			<SegmentedControl
				value={week}
				options={[
					{ value: 'A', label: 'Week A' },
					{ value: 'B', label: 'Week B' }
				]}
				onchange={(v) => (week = v as 'A' | 'B')}
			/>
		{/if}
	{/snippet}
</PageHeader>

<div class="overflow-x-auto">
	<div class="min-w-[720px] rounded-card border border-line bg-white p-3.5 shadow-sm">
		<div class="flex gap-2.5 pb-3">
			<div class="w-[70px] shrink-0"></div>
			{#each days as d (d.n)}
				<div class="flex-1 text-center text-xs font-bold tracking-wide text-muted uppercase">
					{d.label}
				</div>
			{/each}
		</div>
		{#each periods as p (p)}
			<div class="mb-2.5 flex gap-2.5">
				<div class="flex w-[70px] shrink-0 items-center justify-end pr-2 text-right">
					<span class="text-xs font-semibold text-grey-2">P{p}</span>
				</div>
				{#each days as d (d.n)}
					{@const slot = slotFor(d.n, p)}
					{@const cls = slot ? classById(slot.classId) : undefined}
					{@const key = keyFor(d.n, p)}
					<div class="relative flex-1">
						<button
							type="button"
							onclick={() => (openKey = openKey === key ? null : key)}
							class={`flex h-[72px] w-full flex-col items-start justify-center overflow-hidden rounded-xl p-2.5 text-left transition ${
								cls ? '' : 'border border-dashed border-line bg-field hover:border-pink-200'
							}`}
							style={cls
								? `background:${subjectTint(cls.colour).bg};border-left:3px solid ${cls.colour}`
								: ''}
						>
							{#if cls}
								<div
									class="truncate text-[13.5px] font-bold"
									style="color:{subjectTint(cls.colour).text}"
								>
									{cls.name}
								</div>
								<div class="mt-1 text-[11px] text-grey-3">Tap to change</div>
							{:else}
								<span class="mx-auto text-pink-200">
									<svg
										width="18"
										height="18"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<path d="M12 5v14"></path>
										<path d="M5 12h14"></path>
									</svg>
								</span>
							{/if}
						</button>

						<Menu
							open={openKey === key}
							onclose={() => (openKey = null)}
							class="top-2 left-2 w-[180px]"
						>
							<div
								class="px-2.5 py-1.5 text-[11px] font-bold tracking-[0.05em] text-grey-3 uppercase"
							>
								Assign class
							</div>
							{#each data.classes as c (c.id)}
								<form
									method="POST"
									action="?/set"
									use:enhance={() => {
										openKey = null;
									}}
								>
									<input type="hidden" name="weekLetter" value={week} />
									<input type="hidden" name="dayOfWeek" value={d.n} />
									<input type="hidden" name="period" value={p} />
									<input type="hidden" name="classId" value={c.id} />
									<input type="hidden" name="room" value={slot?.room ?? ''} />
									<button
										type="submit"
										class="flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-1.5 text-left text-[13.5px] font-semibold text-grey-1 transition hover:bg-tray"
									>
										<span
											class="h-[9px] w-[9px] shrink-0 rounded-[3px]"
											style="background:{c.colour}"
										></span>
										{c.name}
									</button>
								</form>
							{/each}
							<form method="POST" action="?/set" use:enhance class="px-2.5 py-1.5">
								<input type="hidden" name="weekLetter" value={week} />
								<input type="hidden" name="dayOfWeek" value={d.n} />
								<input type="hidden" name="period" value={p} />
								<input type="hidden" name="classId" value={slot?.classId ?? 0} />
								<input
									name="room"
									placeholder="Room"
									value={slot?.room ?? ''}
									disabled={!slot}
									class="w-full rounded-control border border-line bg-field px-2 py-1 text-sm disabled:opacity-50"
									onblur={(e) => e.currentTarget.form?.requestSubmit()}
									onkeydown={(e) => {
										if (e.key === 'Enter') {
											e.preventDefault();
											e.currentTarget.form?.requestSubmit();
										}
									}}
								/>
							</form>
							{#if slot}
								<form
									method="POST"
									action="?/set"
									use:enhance={() => {
										openKey = null;
									}}
								>
									<input type="hidden" name="weekLetter" value={week} />
									<input type="hidden" name="dayOfWeek" value={d.n} />
									<input type="hidden" name="period" value={p} />
									<input type="hidden" name="classId" value="0" />
									<button
										type="submit"
										class="mt-0.5 flex w-full items-center gap-2.5 rounded-[9px] border-t border-line px-2.5 pt-2 pb-1.5 text-left text-[13px] font-semibold text-danger transition hover:bg-tray"
									>
										<svg
											width="14"
											height="14"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2.2"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<path d="M18 6 6 18"></path>
											<path d="m6 6 12 12"></path>
										</svg>
										Clear slot
									</button>
								</form>
							{/if}
						</Menu>
					</div>
				{/each}
			</div>
		{/each}
	</div>

	<div class="mt-4.5 flex min-w-[720px] flex-wrap gap-4 px-1">
		{#each data.classes as c (c.id)}
			<div class="flex items-center gap-2 text-[13px] text-grey-2">
				<span class="h-[11px] w-[11px] rounded-[4px]" style="background:{c.colour}"></span>
				{c.name}
			</div>
		{/each}
	</div>
</div>
