<script lang="ts">
	import { enhance } from '$app/forms';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import PeriodBadge from '$lib/components/PeriodBadge.svelte';
	import Menu from '$lib/components/Menu.svelte';
	import { subjectTint } from '$lib/colour';
	import { ICON } from '$lib/components/icons';

	let { data, form } = $props<{
		data: import('./$types').PageData;
		form: { moveError?: string } | null;
	}>();

	let openId = $state<number | null>(null);

	const dayFmt = new Intl.DateTimeFormat('en-GB', {
		weekday: 'long',
		day: 'numeric',
		month: 'short'
	});
	function label(d: string) {
		return dayFmt.format(new Date(`${d}T00:00:00Z`));
	}

	const slotFmt = new Intl.DateTimeFormat('en-GB', {
		weekday: 'short',
		day: 'numeric',
		month: 'short'
	});
	function fmtSlot(d: string) {
		return slotFmt.format(new Date(`${d}T00:00:00Z`));
	}
</script>

<PageHeader eyebrow={data.term ? `This week · ${data.term}` : 'This week'} title="Agenda" />

{#if form?.moveError}<p class="mb-3 text-sm text-danger">{form.moveError}</p>{/if}

{#if data.groups.length === 0}
	<EmptyState message="No upcoming lessons. Assign a module to a class to fill your agenda." />
{/if}

{#each data.groups as g (g.date)}
	{@const doneCount = g.items.filter((i: { done: boolean }) => i.done).length}
	<section class="mb-7">
		<div class="mb-3 flex items-baseline gap-2.5">
			<h2 class="m-0 text-base font-bold text-ink">{g.label ?? label(g.date)}</h2>
			{#if g.weekLetter}<span class="text-sm text-grey-3">Week {g.weekLetter}</span>{/if}
			<span class="ml-auto text-[13px] text-grey-4">{doneCount}/{g.items.length} done</span>
		</div>
		<div class="flex flex-col gap-2">
			{#each g.items as item (item.id)}
				{@const t = subjectTint(item.colour)}
				<div
					class="group relative flex items-center gap-4 rounded-[14px] border border-[#F0E9ED] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(43,37,48,0.03)] transition hover:border-pink-200"
				>
					<form method="POST" action="?/toggleDone" use:enhance>
						<input type="hidden" name="id" value={item.id} />
						<input type="hidden" name="done" value={String(!item.done)} />
						<button
							type="submit"
							aria-label={item.done ? 'Mark as not done' : 'Mark as done'}
							class={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition ${
								item.done
									? 'border-[#6FB287] bg-[#6FB287] text-white'
									: 'border-line bg-white text-transparent'
							}`}
						>
							<svg
								width="13"
								height="13"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="3"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<!-- eslint-disable-next-line svelte/no-at-html-tags -- ICON.check is a trusted static icon constant -->
								{@html ICON.check}
							</svg>
						</button>
					</form>

					<PeriodBadge period={item.period} colour={item.colour} dim={item.done} />

					<a href="/classes/{item.classId}/lessons/{item.id}" class="min-w-0 flex-1 no-underline">
						<div
							class={`truncate text-[15px] font-semibold ${item.done ? 'text-grey-4 line-through' : 'text-ink'}`}
						>
							{item.title}
						</div>
						<div class="mt-1 flex flex-wrap items-center gap-2">
							<span
								class="inline-flex h-5 items-center rounded-full px-2 text-[12px] font-bold"
								style="background:{t.soft};color:{t.text}"
							>
								{item.courseName}
							</span>
							<span class="text-[13px] text-grey-2">Class {item.className}</span>
							{#if item.postponed}
								<span
									class="inline-flex h-5 items-center gap-1 rounded-full px-2 text-[11px] font-bold"
									style="background:#FBF0DC;color:#9C7430"
								>
									<svg
										width="11"
										height="11"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2.4"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<!-- eslint-disable-next-line svelte/no-at-html-tags -- ICON.clock is a trusted static icon constant -->
										{@html ICON.clock}
									</svg>
									Postponed
								</span>
							{/if}
						</div>
					</a>

					<div class="flex shrink-0 items-center gap-1.5 text-[13.5px] text-grey-2">
						<svg
							width="15"
							height="15"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.8"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<!-- eslint-disable-next-line svelte/no-at-html-tags -- ICON.pin is a trusted static icon constant -->
							{@html ICON.pin}
						</svg>
						{item.room}
					</div>

					<button
						type="button"
						title="Postpone lesson"
						aria-label="Postpone lesson"
						onclick={() => (openId = openId === item.id ? null : item.id)}
						class="flex shrink-0 items-center rounded-[8px] p-1.5 text-grey-3 transition hover:bg-tray hover:text-ink"
					>
						<svg
							width="17"
							height="17"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.9"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<!-- eslint-disable-next-line svelte/no-at-html-tags -- ICON.clock is a trusted static icon constant -->
							{@html ICON.clock}
						</svg>
					</button>

					<Menu
						open={openId === item.id}
						onclose={() => (openId = null)}
						class="top-14 right-3.5 w-[212px]"
					>
						<div
							class="px-2.5 pb-1.5 pt-1 text-[11px] font-bold uppercase tracking-[0.05em] text-grey-3"
						>
							Postpone to
						</div>
						{#if item.postponeSlots.length === 0}
							<p class="px-2.5 py-2 text-sm text-grey-3">No free slots</p>
						{:else}
							{#each item.postponeSlots as slot (slot.date + '-' + slot.period)}
								<form
									method="POST"
									action="?/postpone"
									use:enhance={() => {
										openId = null;
									}}
								>
									<input type="hidden" name="id" value={item.id} />
									<input type="hidden" name="date" value={slot.date} />
									<input type="hidden" name="period" value={slot.period} />
									<input type="hidden" name="room" value={slot.room} />
									<button
										type="submit"
										class="flex w-full items-center rounded-[9px] px-2.5 py-2 text-left text-sm font-semibold text-grey-1 transition hover:bg-tray"
									>
										{fmtSlot(slot.date)} · P{slot.period}
									</button>
								</form>
							{/each}
						{/if}
					</Menu>
				</div>
			{/each}
		</div>
	</section>
{/each}
