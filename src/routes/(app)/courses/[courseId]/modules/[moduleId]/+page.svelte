<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { dndzone } from 'svelte-dnd-action';
	import Button from '$lib/components/Button.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import ResourceLinks from '$lib/components/ResourceLinks.svelte';
	import ResourceFiles from '$lib/components/ResourceFiles.svelte';
	import { subjectTint } from '$lib/colour';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type Lesson = PageData['lessons'][number];

	let lessons = $derived<Lesson[]>(data.lessons);

	const attachTotal = $derived(
		lessons.reduce((s: number, l: Lesson) => s + (l.attachmentCount ?? 0), 0)
	);

	async function persistOrder() {
		const body = new FormData();
		body.set('orderedIds', lessons.map((l) => l.id).join(','));
		await fetch('?/reorder', { method: 'POST', body });
		await invalidateAll();
	}

	function handleConsider(e: CustomEvent<{ items: Lesson[] }>) {
		lessons = e.detail.items;
	}
	function handleFinalize(e: CustomEvent<{ items: Lesson[] }>) {
		lessons = e.detail.items;
		persistOrder();
	}

	function moved(index: number, dir: -1 | 1): string {
		const ids = lessons.map((l) => l.id);
		const target = index + dir;
		if (target < 0 || target >= ids.length) return ids.join(',');
		[ids[index], ids[target]] = [ids[target], ids[index]];
		return ids.join(',');
	}

	let assignOpen = $state(false);
	let selected = $state<number[]>([]);

	function toggleSelected(id: number) {
		selected = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
	}

	async function confirmAssign() {
		for (const id of selected) {
			const body = new FormData();
			body.set('classId', String(id));
			await fetch('?/assign', { method: 'POST', body });
		}
		assignOpen = false;
		selected = [];
		await invalidateAll();
	}
</script>

<div class="mb-3.5 flex items-center gap-2 text-[13px] text-grey-2">
	<a href="/courses/{data.module.courseId}" class="font-bold text-pink-dk">Course</a>
	<svg
		width="14"
		height="14"
		viewBox="0 0 24 24"
		fill="none"
		stroke="#CFC7D0"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"><path d="m9 18 6-6-6-6"></path></svg
	>
	<span>Module</span>
</div>

<div class="flex flex-wrap items-start justify-between gap-4">
	<div class="min-w-[240px] flex-1">
		<form method="POST" action="?/rename" use:enhance>
			<input type="hidden" name="id" value={data.module.id} />
			<input
				name="name"
				value={data.module.name}
				placeholder="Module name"
				aria-label="Module name"
				class="w-full bg-transparent font-display text-[32px] font-medium tracking-[-0.015em] text-ink outline-none"
				onblur={(e) => e.currentTarget.form?.requestSubmit()}
			/>
		</form>
		<form method="POST" action="?/saveDescription" use:enhance>
			<input
				name="description"
				value={data.module.description ?? ''}
				placeholder="Add a description…"
				aria-label="Module description"
				class="w-full max-w-[560px] bg-transparent text-[15px] text-grey-2 outline-none"
				onblur={(e) => e.currentTarget.form?.requestSubmit()}
			/>
		</form>
		<div class="mt-3.5 flex items-center gap-4 text-[13px] text-grey-2">
			<span class="flex items-center gap-1.5">
				<svg
					width="15"
					height="15"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.9"
					stroke-linecap="round"
					stroke-linejoin="round"
					><path d="m12 3 9 5-9 5-9-5 9-5Z"></path><path d="m3 13 9 5 9-5"></path></svg
				>{lessons.length} lessons</span
			>
			<span class="flex items-center gap-1.5">
				<svg
					width="15"
					height="15"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.9"
					stroke-linecap="round"
					stroke-linejoin="round"
					><path
						d="m21.5 11-8.6 8.6a5 5 0 0 1-7-7l8.6-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.7 8.6a1.7 1.7 0 0 1-2.4-2.4l8-8"
					></path></svg
				>{attachTotal} attachments</span
			>
		</div>
	</div>
	<div class="flex shrink-0 gap-2.5">
		<Button variant="primary" onclick={() => (assignOpen = true)}>
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.9"
				stroke-linecap="round"
				stroke-linejoin="round"
				><circle cx="9" cy="8" r="3.2"></circle><path d="M3.5 20a5.5 5.5 0 0 1 11 0"></path><path
					d="M16 5.2a3 3 0 0 1 0 5.6"
				></path><path d="M18.5 20a5.5 5.5 0 0 0-3-4.9"></path></svg
			>
			Assign to class
		</Button>
	</div>
</div>

<div class="mt-4 flex flex-wrap items-start gap-7">
	<div class="min-w-[320px] flex-[3_1_420px]">
		<div
			class="flex items-center gap-2 px-1 pb-3 text-xs font-bold tracking-[0.05em] text-grey-3 uppercase"
		>
			<span>Lesson sequence</span>
			<span class="font-medium tracking-normal text-grey-3 normal-case">· drag to reorder</span>
		</div>

		{#if lessons.length === 0}
			<EmptyState message="No lessons in this module yet." />
		{:else}
			<ul
				class="flex flex-col gap-2.5"
				use:dndzone={{ items: lessons, flipDurationMs: 150 }}
				onconsider={handleConsider}
				onfinalize={handleFinalize}
			>
				{#each lessons as l, i (l.id)}
					<li
						class="group flex items-start gap-3.5 rounded-card border border-line bg-white px-[18px] py-4 shadow-[0_1px_2px_rgba(43,37,48,0.03)] transition hover:border-pink-200 hover:shadow-[0_4px_14px_-6px_rgba(43,37,48,0.10)]"
					>
						<div class="flex shrink-0 flex-col items-center gap-2 pt-0.5">
							<span class="flex cursor-grab text-grey-3" title="Drag to reorder" aria-hidden="true">
								<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
									<circle cx="9" cy="6" r="1.6"></circle><circle cx="15" cy="6" r="1.6"
									></circle><circle cx="9" cy="12" r="1.6"></circle><circle cx="15" cy="12" r="1.6"
									></circle><circle cx="9" cy="18" r="1.6"></circle><circle cx="15" cy="18" r="1.6"
									></circle>
								</svg>
							</span>
							<span
								class="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
								style="background:{subjectTint(data.courseColour).bg};color:{subjectTint(
									data.courseColour
								).dot}"
							>
								{i + 1}
							</span>
						</div>

						<div class="min-w-0 flex-1">
							<form method="POST" action="?/rename" use:enhance>
								<input type="hidden" name="id" value={l.id} />
								<input
									name="title"
									value={l.title}
									placeholder="Untitled lesson"
									aria-label="Lesson title"
									class="-mx-2 -mt-1 mb-0.5 w-[calc(100%+1rem)] rounded-control border border-transparent bg-transparent px-2 py-1 text-[16.5px] font-semibold text-ink hover:border-line focus:border-pink-200 focus:bg-field focus:outline-none"
									onblur={(e) => e.currentTarget.form?.requestSubmit()}
								/>
							</form>
							<form method="POST" action="?/saveLessonNote" use:enhance>
								<input type="hidden" name="id" value={l.id} />
								<input
									name="note"
									value={l.note ?? ''}
									placeholder="Add a short objective…"
									aria-label="Lesson objective"
									class="-mx-2 mb-2 w-[calc(100%+1rem)] rounded-control border border-transparent bg-transparent px-2 py-1 text-[13.5px] text-grey-2 hover:border-line focus:border-pink-200 focus:bg-field focus:outline-none"
									onblur={(e) => e.currentTarget.form?.requestSubmit()}
								/>
							</form>

							<div class="flex flex-wrap items-center gap-2">
								{#if l.attachmentCount > 0}
									<span
										class="flex items-center gap-1.5 rounded-[9px] border border-line bg-field px-2.5 py-1 text-xs font-semibold text-grey-2"
									>
										<svg
											width="13"
											height="13"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="1.9"
											stroke-linecap="round"
											stroke-linejoin="round"
											><path
												d="m21.5 11-8.6 8.6a5 5 0 0 1-7-7l8.6-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.7 8.6a1.7 1.7 0 0 1-2.4-2.4l8-8"
											></path></svg
										>
										{l.attachmentCount}
									</span>
								{/if}
							</div>
						</div>

						<div class="flex shrink-0 flex-col items-end gap-2">
							<div
								class="flex items-center gap-1 opacity-0 transition [@media(hover:hover)]:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
							>
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
										disabled={i === lessons.length - 1}
										aria-label="Move down">↓</button
									>
								</form>
								<a
									href="/courses/{data.module.courseId}/modules/{data.module.id}/lessons/{l.id}"
									title="Open lesson"
									class="flex rounded-control p-1.5 text-grey-3 hover:bg-field hover:text-ink"
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
										><path d="M7 17 17 7"></path><path d="M8 7h9v9"></path></svg
									>
								</a>
								<form method="POST" action="?/delete" use:enhance>
									<input type="hidden" name="id" value={l.id} />
									<button
										type="submit"
										aria-label="Delete lesson"
										class="flex rounded-control p-1.5 text-grey-3 hover:bg-pink-50 hover:text-pink"
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
											><path d="M3 6h18"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
											></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path></svg
										>
									</button>
								</form>
							</div>
						</div>
					</li>
				{/each}
			</ul>
		{/if}

		<form method="POST" action="?/create" use:enhance class="mt-2.5 flex items-center gap-3">
			<input
				name="title"
				placeholder="Add a lesson to this module"
				required
				class="flex-1 rounded-card border border-dashed border-line bg-transparent px-[18px] py-3.5 text-[14.5px] font-semibold text-grey-3 placeholder:text-grey-3 focus:border-pink-200 focus:outline-none"
			/>
			<Button type="submit" variant="secondary">Add lesson</Button>
		</form>
	</div>

	<aside class="flex min-w-[280px] flex-[1_1_300px] flex-col gap-4.5">
		<section
			class="rounded-card border border-line bg-white p-[18px] shadow-[0_1px_2px_rgba(43,37,48,0.03)]"
		>
			<div class="mb-3.5 flex items-center gap-2">
				<span class="flex text-[#5B86C4]">
					<svg
						width="17"
						height="17"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.9"
						stroke-linecap="round"
						stroke-linejoin="round"
						><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5"></path><path
							d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"
						></path></svg
					>
				</span>
				<h3 class="m-0 text-[14.5px] font-bold text-ink">Web links</h3>
				<span class="ml-auto text-xs text-grey-3">{data.links.length}</span>
			</div>
			<ResourceLinks links={data.links} />
		</section>

		<section
			class="rounded-card border border-line bg-white p-[18px] shadow-[0_1px_2px_rgba(43,37,48,0.03)]"
		>
			<div class="mb-3.5 flex items-center gap-2">
				<span class="flex text-[#8775C6]">
					<svg
						width="17"
						height="17"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.9"
						stroke-linecap="round"
						stroke-linejoin="round"
						><path d="M14 3v5h5"></path><path
							d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"
						></path></svg
					>
				</span>
				<h3 class="m-0 text-[14.5px] font-bold text-ink">Files</h3>
				<span class="ml-auto text-xs text-grey-3">{data.files.length}</span>
			</div>
			<ResourceFiles files={data.files} ownerType="module" ownerId={data.module.id} />
		</section>
	</aside>
</div>

{#if assignOpen}
	<Modal onclose={() => (assignOpen = false)}>
		<div class="flex items-start gap-3 border-b border-line p-[22px] pb-4">
			<span
				class="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] bg-pink-50 text-pink-dk"
			>
				<svg
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.9"
					stroke-linecap="round"
					stroke-linejoin="round"
					><circle cx="9" cy="8" r="3.2"></circle><path d="M3.5 20a5.5 5.5 0 0 1 11 0"></path><path
						d="M16 5.2a3 3 0 0 1 0 5.6"
					></path><path d="M18.5 20a5.5 5.5 0 0 0-3-4.9"></path></svg
				>
			</span>
			<div class="min-w-0 flex-1">
				<h2 class="m-0 font-display text-xl font-medium text-ink">Assign to classes</h2>
				<p class="m-0 mt-0.5 text-[13.5px] text-grey-2">
					Add <strong class="font-bold text-grey-1">{data.module.name}</strong> to your teaching schedule
				</p>
			</div>
			<button
				type="button"
				aria-label="Close"
				class="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] text-grey-3 hover:bg-field"
				onclick={() => (assignOpen = false)}
			>
				<svg
					width="17"
					height="17"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.2"
					stroke-linecap="round"
					stroke-linejoin="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg
				>
			</button>
		</div>

		<div class="p-4">
			<span class="block px-2 py-1 text-[11px] font-bold tracking-[0.05em] text-grey-3 uppercase">
				Your classes
			</span>
			<div class="mt-1.5 flex max-h-[280px] flex-col gap-0.5 overflow-y-auto">
				{#if data.classes.length === 0}
					<p class="px-2 py-2 text-sm text-muted">No classes study this course yet.</p>
				{:else}
					{#each data.classes as c (c.id)}
						{@const isSelected = selected.includes(c.id)}
						<button
							type="button"
							onclick={() => toggleSelected(c.id)}
							class="flex items-center gap-2.5 rounded-control px-2.5 py-2.5 text-left hover:bg-field"
						>
							<span
								class="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[6px] border {isSelected
									? 'border-pink bg-pink text-white'
									: 'border-line bg-white text-transparent'}"
							>
								<svg
									width="13"
									height="13"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="3"
									stroke-linecap="round"
									stroke-linejoin="round"><path d="M20 6 9 17l-5-5"></path></svg
								>
							</span>
							<span class="h-2.5 w-2.5 shrink-0 rounded-[3px]" style="background:{c.colour}"></span>
							<span class="flex-1 text-[14.5px] font-semibold text-ink">{c.name}</span>
						</button>
					{/each}
				{/if}
			</div>
		</div>

		<div class="flex items-center gap-3 border-t border-line p-[18px] pt-3.5">
			<span class="flex-1 text-[12.5px] leading-snug text-grey-3">
				Lessons are added to each class's timetable.
			</span>
			<Button variant="secondary" onclick={() => (assignOpen = false)}>Cancel</Button>
			<Button variant="primary" disabled={selected.length === 0} onclick={confirmAssign}>
				Assign to {selected.length} class(es)
			</Button>
		</div>
	</Modal>
{/if}
