<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { dndzone } from 'svelte-dnd-action';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import SubjectDot from '$lib/components/SubjectDot.svelte';

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
<PageHeader title={data.klass.name} subtitle={data.klass.courseName} />

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
				class="group flex items-center gap-3 rounded-card border px-4 py-3 text-sm transition
				{item.date === null
					? 'border-dashed border-line bg-field/50 text-muted'
					: 'border-line bg-white hover:border-pink-200'}"
			>
				<span class="cursor-grab select-none px-1 text-muted" aria-hidden="true">⠿</span>

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
					<span class="w-28 shrink-0 font-semibold text-ink/80">{label(item.date)}</span>
					<span class="w-7 shrink-0 font-bold text-muted">P{item.period}</span>
					{#if item.weekLetter}<span class="w-10 shrink-0 text-xs text-muted"
							>Wk {item.weekLetter}</span
						>{/if}
				{:else}
					<span class="w-28 shrink-0 text-xs italic">unscheduled</span>
				{/if}

				<SubjectDot colour={data.klass.colour} shape="bar" />

				<form method="POST" action="?/rename" use:enhance class="flex flex-1 items-center gap-2">
					<input type="hidden" name="id" value={item.id} />
					<input
						name="title"
						value={item.title}
						aria-label="Lesson title"
						class="flex-1 rounded-control border border-transparent bg-transparent px-2 py-1 text-sm hover:border-line focus:border-pink-200 focus:bg-white"
					/>
					<Button type="submit" variant="secondary" size="sm">Save</Button>
				</form>

				{#if item.room}<span
						class="rounded-md bg-field px-2 py-0.5 text-xs font-semibold text-muted"
						>{item.room}</span
					>{/if}

				<div class="flex items-center gap-2 opacity-0 transition group-hover:opacity-100">
					<a
						href="/classes/{data.klass.id}/lessons/{item.id}"
						class="rounded-control border border-line px-2 py-1 text-xs font-medium hover:border-pink-200"
						>Open</a
					>
					<form method="POST" action="?/insertBlank" use:enhance>
						<input type="hidden" name="beforeId" value={item.id} />
						<Button type="submit" variant="secondary" size="sm">+ Blank above</Button>
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

<Card>
	<form method="POST" action="?/insertBlank" use:enhance class="flex items-end gap-3">
		<Button type="submit">Add blank lesson at end</Button>
	</form>
</Card>
