<script lang="ts">
	import { enhance } from '$app/forms';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Button from '$lib/components/Button.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import SubjectDot from '$lib/components/SubjectDot.svelte';

	let { data, form } = $props<{
		data: import('./$types').PageData;
		form: { moveError?: string } | null;
	}>();

	const dayFmt = new Intl.DateTimeFormat('en-GB', {
		weekday: 'long',
		day: 'numeric',
		month: 'short'
	});
	function label(d: string) {
		return dayFmt.format(new Date(`${d}T00:00:00Z`));
	}
</script>

<PageHeader title="Agenda" subtitle="Your upcoming lessons, grouped by day." />

{#if form?.moveError}<p class="mb-3 text-sm text-danger">{form.moveError}</p>{/if}

{#if data.groups.length === 0}
	<EmptyState message="No upcoming lessons. Assign a module to a class to fill your agenda." />
{/if}

{#each data.groups as g (g.date)}
	<section class="mb-6">
		<h2 class="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-ink/80">
			{label(g.date)}
			{#if g.weekLetter}<span class="text-xs font-normal text-muted">· Week {g.weekLetter}</span
				>{/if}
		</h2>
		<div class="flex flex-col gap-2">
			{#each g.items as item (item.id)}
				<div
					class="group flex items-center gap-3.5 rounded-card border border-line bg-white px-4 py-3 text-sm transition hover:border-pink-200 hover:shadow-[0_3px_12px_rgba(80,20,50,0.07)]"
				>
					<span class="w-6 font-bold text-muted">P{item.period}</span>
					<SubjectDot colour={item.colour} shape="bar" />
					<a href="/classes/{item.classId}" class="w-16 font-bold text-pink-dk hover:underline"
						>{item.className}</a
					>
					<span class="flex-1 text-ink/80">{item.courseName} — {item.title}</span>
					<span class="rounded-md bg-field px-2 py-0.5 text-xs font-semibold text-muted"
						>{item.room}</span
					>
					<div class="flex items-center gap-2 opacity-0 transition group-hover:opacity-100">
						<form
							method="POST"
							action="/agenda?/moveLesson"
							use:enhance
							class="flex items-center gap-1"
						>
							<input type="hidden" name="id" value={item.id} />
							<input
								type="date"
								name="date"
								required
								class="rounded-control border border-line bg-field px-2 py-1 text-xs"
							/>
							<input
								type="number"
								name="period"
								min="1"
								placeholder="P"
								required
								class="w-12 rounded-control border border-line bg-field px-2 py-1 text-xs"
							/>
							<Button type="submit" variant="secondary" size="sm">Move</Button>
						</form>
						<form method="POST" action="/agenda?/deleteLesson" use:enhance>
							<input type="hidden" name="id" value={item.id} />
							<Button type="submit" variant="danger" size="sm">Delete</Button>
						</form>
					</div>
				</div>
			{/each}
		</div>
	</section>
{/each}
