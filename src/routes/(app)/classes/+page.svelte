<script lang="ts">
	import { enhance } from '$app/forms';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import ConfirmDelete from '$lib/components/ConfirmDelete.svelte';
	let { data } = $props();
</script>

<PageHeader eyebrow="Your teaching groups" title="Classes" />

{#if data.classes.length === 0}
	<EmptyState message="No classes yet." />
{:else}
	<div class="mb-6 flex flex-col gap-2.5">
		{#each data.classes as c (c.id)}
			<div class="group relative">
				<a
					href="/classes/{c.id}"
					class="flex items-center gap-[15px] rounded-card border border-line bg-white px-[18px] py-4 shadow-[0_1px_2px_rgba(43,37,48,0.03)] transition hover:border-pink-200 hover:shadow-[0_4px_14px_-6px_rgba(43,37,48,0.10)]"
				>
					<span
						class="h-3.5 w-3.5 shrink-0 rounded"
						style="background:{c.colour}"
						aria-hidden="true"
					></span>
					<div class="min-w-0 flex-1">
						<div class="truncate text-[17px] font-bold text-ink">{c.name}</div>
						<div class="truncate text-sm text-muted">{c.courseName}</div>
					</div>
				</a>
				<div
					class="absolute inset-y-0 right-12 flex items-center gap-1 opacity-100 transition [@media(hover:hover)]:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
				>
					<ConfirmDelete type="class" id={c.id} name={c.name}>
						{#snippet trigger(open)}
							<button
								type="button"
								onclick={open}
								title="Delete class"
								class="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] text-grey-3 transition hover:bg-pink-50 hover:text-pink-dk"
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
									<path d="M3 6h18"></path>
									<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
									<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
								</svg>
							</button>
						{/snippet}
					</ConfirmDelete>
				</div>
				<span
					class="pointer-events-none absolute inset-y-0 right-[18px] flex items-center text-grey-3"
				>
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
						<path d="m9 18 6-6-6-6"></path>
					</svg>
				</span>
			</div>
		{/each}
	</div>
{/if}

{#if data.courses.length === 0}
	<p class="text-sm text-muted">Create a course first.</p>
{:else}
	<Card>
		<form method="POST" action="?/create" use:enhance class="flex flex-wrap items-end gap-3">
			<input
				name="name"
				placeholder="10Phy1"
				required
				class="rounded-control border border-line bg-field px-3 py-2 text-sm"
			/>
			<select name="courseId" class="rounded-control border border-line bg-field px-3 py-2 text-sm">
				{#each data.courses as course (course.id)}
					<option value={course.id}>{course.name}</option>
				{/each}
			</select>
			<input
				name="colour"
				type="color"
				value="#8775c6"
				class="h-9 w-12 rounded-control border border-line"
			/>
			<Button type="submit">Add class</Button>
		</form>
	</Card>
{/if}
