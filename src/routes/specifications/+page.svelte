<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { Plus } from 'lucide-svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let filterLevel = $state<'all' | 'GCSE' | 'A-Level'>('all');

	// Filtered specifications based on level filter
	let filteredSpecs = $derived(
		filterLevel === 'all' ? data.specs : data.specs.filter((s) => s.level === filterLevel)
	);

	// Group specifications by level
	let specsByLevel = $derived(
		filteredSpecs.reduce(
			(acc, spec) => {
				if (!acc[spec.level]) {
					acc[spec.level] = [];
				}
				acc[spec.level].push(spec);
				return acc;
			},
			{} as Record<string, typeof data.specs>
		)
	);
</script>

<div class="container mx-auto p-4 sm:p-6">
	<div class="mb-4 sm:mb-6">
		<div class="flex items-start justify-between gap-4">
			<div class="flex-1">
				<h1 class="text-2xl font-bold sm:text-3xl">Specification Browser</h1>
				<p class="mt-2 text-sm text-muted-foreground sm:text-base">
					Browse UK Physics exam specifications by board and level
				</p>
			</div>
			<Button href={resolve('/specifications/new')}>
				<Plus class="mr-2 h-4 w-4" />
				Add Specification
			</Button>
		</div>
	</div>

	{#if data.specs.length > 0}
		<div class="mb-4 flex flex-col gap-2 sm:mb-6 sm:flex-row sm:items-center sm:gap-4">
			<label for="levelFilter" class="text-sm font-medium text-foreground">
				Filter by Level:
			</label>
			<select
				id="levelFilter"
				bind:value={filterLevel}
				class="min-h-[44px] w-full rounded-md border border-border-strong bg-surface px-3 py-2 shadow-sm focus:border-accent-secondary focus:ring-accent-secondary focus:outline-none sm:w-auto"
			>
				<option value="all">All Levels</option>
				<option value="GCSE">GCSE</option>
				<option value="A-Level">A-Level</option>
			</select>
		</div>
	{/if}

	{#if data.specs.length === 0}
		<div class="rounded-lg border border-border bg-background-subtle p-8 text-center">
			<p class="text-muted-foreground">
				No exam specifications found. Run the seed script to populate specifications.
			</p>
		</div>
	{:else if filteredSpecs.length === 0}
		<div class="rounded-lg border border-border bg-background-subtle p-8 text-center">
			<p class="text-muted-foreground">No specifications match the selected filter.</p>
		</div>
	{:else}
		{#each Object.entries(specsByLevel) as [level, specs] (level)}
			<div class="mb-6 sm:mb-8">
				<h2 class="mb-3 text-xl font-semibold sm:mb-4 sm:text-2xl">{level}</h2>
				<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{#each specs as spec (spec.id)}
						<a
							href={resolve(`/specifications/${spec.id}`)}
							data-sveltekit-preload-data
							class="block min-h-[44px] rounded-lg border border-border bg-surface p-4 shadow-sm transition-shadow hover:shadow-md active:shadow-lg sm:p-6"
						>
							<h3 class="mb-2 text-lg font-semibold sm:text-xl">{spec.board}</h3>
							<p class="mb-3 text-sm text-muted-foreground">{spec.name}</p>
							<div class="space-y-1 text-sm text-muted-foreground">
								{#if spec.specCode}
									<p>
										<span class="font-medium">Code:</span>
										{spec.specCode}
									</p>
								{/if}
								{#if spec.specYear}
									<p>
										<span class="font-medium">Year:</span>
										{spec.specYear}
									</p>
								{/if}
							</div>
						</a>
					{/each}
				</div>
			</div>
		{/each}
	{/if}
</div>
