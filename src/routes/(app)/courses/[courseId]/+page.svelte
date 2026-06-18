<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { dndzone } from 'svelte-dnd-action';
	import Button from '$lib/components/Button.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import ConfirmDelete from '$lib/components/ConfirmDelete.svelte';
	import ResourceLinks from '$lib/components/ResourceLinks.svelte';
	import ResourceFiles from '$lib/components/ResourceFiles.svelte';
	import { subjectTint } from '$lib/colour';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type Module = PageData['modules'][number];

	let modules = $derived<Module[]>(data.modules);

	async function persistOrder() {
		const body = new FormData();
		body.set('orderedIds', modules.map((m) => m.id).join(','));
		await fetch('?/reorder', { method: 'POST', body });
		await invalidateAll();
	}

	function handleConsider(e: CustomEvent<{ items: Module[] }>) {
		modules = e.detail.items;
	}
	function handleFinalize(e: CustomEvent<{ items: Module[] }>) {
		modules = e.detail.items;
		persistOrder();
	}

	function moved(index: number, dir: -1 | 1): string {
		const ids = modules.map((m) => m.id);
		const target = index + dir;
		if (target < 0 || target >= ids.length) return ids.join(',');
		[ids[index], ids[target]] = [ids[target], ids[index]];
		return ids.join(',');
	}
</script>

<div class="mb-3.5 flex items-center gap-2 text-[13px] text-grey-2">
	<a href="/courses" class="font-bold text-pink-dk">Courses</a>
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
	<span>{data.course.name}</span>
</div>

<form method="POST" action="?/save" use:enhance class="flex items-center gap-3.5">
	<label
		class="h-9 w-9 shrink-0 cursor-pointer rounded-full border border-line"
		style="background:{data.course.colour}"
		title="Change colour"
	>
		<input
			type="color"
			name="colour"
			value={data.course.colour}
			class="sr-only"
			onchange={(e) => e.currentTarget.form?.requestSubmit()}
		/>
	</label>
	<input
		name="name"
		value={data.course.name}
		placeholder="Subject name"
		aria-label="Subject name"
		class="min-w-0 flex-1 bg-transparent font-display text-[32px] font-medium tracking-[-0.015em] text-ink outline-none"
		onblur={(e) => e.currentTarget.form?.requestSubmit()}
	/>
</form>

<div class="mt-3 mb-7 flex items-center gap-4 text-[13px] text-grey-2">
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
		>{data.modules.length} modules</span
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
		>{data.links.length + data.files.length} resources</span
	>
</div>

<div class="flex flex-wrap items-start gap-7">
	<div class="min-w-[320px] flex-[3_1_420px]">
		<div
			class="flex items-center gap-2 px-1 pb-3 text-xs font-bold tracking-[0.05em] text-grey-3 uppercase"
		>
			<span>Modules</span>
			<span class="font-medium tracking-normal text-grey-3 normal-case">· drag to reorder</span>
		</div>

		{#if data.modules.length === 0}
			<EmptyState message="No modules yet. Add the first one below." />
		{:else}
			<ul
				class="flex flex-col gap-2.5"
				use:dndzone={{ items: modules, flipDurationMs: 150 }}
				onconsider={handleConsider}
				onfinalize={handleFinalize}
			>
				{#each modules as m, i (m.id)}
					<li
						class="group flex items-center gap-3 rounded-card border border-line bg-white px-[18px] py-4 shadow-[0_1px_2px_rgba(43,37,48,0.03)] transition hover:border-pink-200 hover:shadow-[0_4px_14px_-6px_rgba(43,37,48,0.10)]"
					>
						<span
							class="flex shrink-0 cursor-grab text-grey-3"
							title="Drag to reorder"
							aria-hidden="true"
						>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
								<circle cx="9" cy="6" r="1.6"></circle><circle cx="15" cy="6" r="1.6"
								></circle><circle cx="9" cy="12" r="1.6"></circle><circle cx="15" cy="12" r="1.6"
								></circle><circle cx="9" cy="18" r="1.6"></circle><circle cx="15" cy="18" r="1.6"
								></circle>
							</svg>
						</span>
						<span
							class="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px]"
							style="background:{subjectTint(data.course.colour).bg};color:{subjectTint(
								data.course.colour
							).dot}"
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
								><path d="m12 3 9 5-9 5-9-5 9-5Z"></path><path d="m3 13 9 5 9-5"></path></svg
							>
						</span>
						<a
							href="/courses/{data.course.id}/modules/{m.id}"
							class="min-w-0 flex-1 truncate text-[15.5px] font-semibold text-ink">{m.name}</a
						>
						<div class="flex shrink-0 items-center gap-1">
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
									disabled={i === modules.length - 1}
									aria-label="Move down">↓</button
								>
							</form>
							<ConfirmDelete type="module" id={m.id} name={m.name}>
								{#snippet trigger(open)}
									<button
										type="button"
										onclick={open}
										title="Delete module"
										class="px-1 text-grey-3 opacity-100 transition [@media(hover:hover)]:opacity-0 hover:text-pink-dk group-hover:opacity-100 group-focus-within:opacity-100"
									>
										<svg
											width="16"
											height="16"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="1.9"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<path d="M3 6h18"></path>
											<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
											<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
										</svg>
									</button>
								{/snippet}
							</ConfirmDelete>
						</div>
						<a
							href="/courses/{data.course.id}/modules/{m.id}"
							class="flex shrink-0 text-grey-3"
							aria-hidden="true"
						>
							<svg
								width="18"
								height="18"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"><path d="m9 18 6-6-6-6"></path></svg
							>
						</a>
					</li>
				{/each}
			</ul>
		{/if}

		<form method="POST" action="?/create" use:enhance class="mt-2.5 flex items-center gap-3">
			<input
				name="name"
				placeholder="Add module"
				required
				class="flex-1 rounded-card border border-dashed border-line bg-transparent px-[18px] py-3.5 text-[14.5px] font-semibold text-grey-3 placeholder:text-grey-3 focus:border-pink-200 focus:outline-none"
			/>
			<Button type="submit" variant="secondary">Add module</Button>
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
			<ResourceFiles files={data.files} ownerType="course" ownerId={data.course.id} />
		</section>
	</aside>
</div>
