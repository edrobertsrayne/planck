<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { dndzone } from 'svelte-dnd-action';
	import Button from '$lib/components/Button.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import PeriodBadge from '$lib/components/PeriodBadge.svelte';
	import { subjectTint } from '$lib/colour';

	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type Item = PageData['items'][number];

	// Local, drag-mutable copy of the sequence. Re-synced whenever the load data changes.
	let items = $derived<Item[]>(data.items);

	const dayFmt = new Intl.DateTimeFormat('en-GB', {
		weekday: 'short',
		day: 'numeric',
		month: 'short'
	});
	function label(d: string) {
		return dayFmt.format(new Date(`${d}T00:00:00Z`));
	}

	async function persistOrder() {
		const body = new FormData();
		body.set('orderedIds', items.map((i) => i.id).join(','));
		await fetch('?/reorder', { method: 'POST', body });
		await invalidateAll();
	}

	function handleConsider(e: CustomEvent<{ items: Item[] }>) {
		items = e.detail.items;
	}
	function handleFinalize(e: CustomEvent<{ items: Item[] }>) {
		items = e.detail.items;
		persistOrder();
	}

	function moved(index: number, dir: -1 | 1): string {
		const ids = items.map((i) => i.id);
		const target = index + dir;
		if (target < 0 || target >= ids.length) return ids.join(',');
		[ids[index], ids[target]] = [ids[target], ids[index]];
		return ids.join(',');
	}

	const firstOverflowId = $derived(items.find((i) => i.date === null)?.id ?? null);
</script>

<a href="/classes" class="text-sm font-medium text-pink-dk hover:underline">← Classes</a>

<header class="mt-3 mb-7">
	<div class="mb-1.5 flex items-center gap-2 text-[13px] font-semibold text-pink-dk">
		<span class="h-2.5 w-2.5 rounded" style="background:{data.klass.colour}" aria-hidden="true"
		></span>
		<span>Class</span>
	</div>
	<form method="POST" action="?/save" use:enhance class="flex items-center gap-3.5">
		<input type="hidden" name="courseId" value={data.klass.courseId} />
		<label
			class="h-9 w-9 shrink-0 cursor-pointer rounded-full border border-line"
			style="background:{data.klass.colour}"
			title="Change colour"
		>
			<input
				type="color"
				name="colour"
				value={data.klass.colour}
				class="sr-only"
				onchange={(e) => e.currentTarget.form?.requestSubmit()}
			/>
		</label>
		<input
			name="name"
			value={data.klass.name}
			placeholder="Class name"
			aria-label="Class name"
			class="min-w-0 flex-1 bg-transparent font-display text-[33px] font-medium tracking-[-0.015em] text-ink outline-none"
			onblur={(e) => e.currentTarget.form?.requestSubmit()}
		/>
	</form>
	<p class="mt-1.5 text-[15px] text-grey-2">
		{data.klass.courseName} · {items.length}
		{items.length === 1 ? 'lesson' : 'lessons'}
	</p>
</header>

{#if items.length === 0}
	<EmptyState message="No lessons scheduled for this class yet. Assign a module from its course." />
{:else}
	<ul
		class="mb-4 flex flex-col gap-2"
		use:dndzone={{ items, flipDurationMs: 150 }}
		onconsider={handleConsider}
		onfinalize={handleFinalize}
	>
		{#each items as item, i (item.id)}
			{#if item.id === firstOverflowId}
				<li class="mt-2 px-1 text-xs font-semibold text-muted">
					No timetabled slot yet — these will be scheduled when space frees up.
				</li>
			{/if}
			<li
				class="group flex items-center gap-3 rounded-card border px-4 py-3 transition
				{item.date === null
					? 'border-dashed border-line bg-field/50'
					: 'border-line bg-white shadow-[0_1px_2px_rgba(43,37,48,0.03)] hover:border-pink-200'}"
			>
				<span class="cursor-grab select-none px-1 text-grey-3" aria-hidden="true">⠿</span>

				<div class="flex flex-col gap-0.5">
					<form method="POST" action="?/reorder" use:enhance>
						<input type="hidden" name="orderedIds" value={moved(i, -1)} />
						<button
							class="px-1 text-muted hover:text-ink disabled:opacity-30"
							disabled={i === 0}
							aria-label="Move up">↑</button
						>
					</form>
					<form method="POST" action="?/reorder" use:enhance>
						<input type="hidden" name="orderedIds" value={moved(i, 1)} />
						<button
							class="px-1 text-muted hover:text-ink disabled:opacity-30"
							disabled={i === items.length - 1}
							aria-label="Move down">↓</button
						>
					</form>
				</div>

				{#if item.date}
					<PeriodBadge period={item.period ?? 0} colour={data.klass.courseColour} />
					<div class="flex w-24 shrink-0 flex-col gap-0.5 text-xs">
						<span class="font-semibold text-ink/80">{label(item.date)}</span>
						{#if item.weekLetter}<span class="text-grey-3">Wk {item.weekLetter}</span>{/if}
					</div>
					<span
						class="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold"
						style="background:{subjectTint(data.klass.courseColour).soft};color:{subjectTint(
							data.klass.courseColour
						).text}"
					>
						{data.klass.courseName}
					</span>
				{:else}
					<span
						class="w-24 shrink-0 rounded-[12px] bg-field px-1 py-3 text-center text-[11px] font-semibold text-grey-3 italic"
						>Unscheduled</span
					>
				{/if}

				<form method="POST" action="?/rename" use:enhance class="flex flex-1 items-center gap-2">
					<input type="hidden" name="id" value={item.id} />
					<input
						name="title"
						value={item.title}
						aria-label="Lesson title"
						class="flex-1 rounded-control border border-transparent bg-transparent px-2 py-1 text-[15px] font-medium text-ink hover:border-line focus:border-pink-200 focus:bg-white focus:outline-none"
						onblur={(e) => e.currentTarget.form?.requestSubmit()}
					/>
				</form>

				{#if item.room}<span
						class="shrink-0 rounded-md bg-field px-2 py-0.5 text-xs font-semibold text-muted"
						>{item.room}</span
					>{/if}

				<div
					class="flex shrink-0 items-center gap-2 opacity-100 transition [@media(hover:hover)]:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
				>
					<a
						href="/classes/{data.klass.id}/lessons/{item.id}"
						class="rounded-control border border-line px-2 py-1 text-xs font-medium hover:border-pink-200"
						>Open</a
					>
					<form method="POST" action="?/insertBlank" use:enhance>
						<input type="hidden" name="beforeId" value={item.id} />
						<Button type="submit" variant="secondary" size="sm">+ Blank</Button>
					</form>
					<form method="POST" action="?/delete" use:enhance>
						<input type="hidden" name="id" value={item.id} />
						<Button type="submit" variant="danger" size="sm">Delete</Button>
					</form>
				</div>
			</li>
		{/each}
	</ul>
{/if}

<form method="POST" action="?/insertBlank" use:enhance>
	<Button type="submit" variant="secondary">+ Add blank lesson at end</Button>
</form>
