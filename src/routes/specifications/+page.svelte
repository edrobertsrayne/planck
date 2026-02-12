<script lang="ts">
	import { resolve } from '$app/paths';
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

<div class="container mx-auto p-6">
	<div class="mb-6">
		<h1 class="text-3xl font-bold">Specification Browser</h1>
		<p class="mt-2 text-gray-600">Browse UK Physics exam specifications by board and level</p>
	</div>

	{#if data.specs.length > 0}
		<div class="mb-6 flex items-center gap-4">
			<label for="levelFilter" class="text-sm font-medium text-gray-700"> Filter by Level: </label>
			<select
				id="levelFilter"
				bind:value={filterLevel}
				class="rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
			>
				<option value="all">All Levels</option>
				<option value="GCSE">GCSE</option>
				<option value="A-Level">A-Level</option>
			</select>
		</div>
	{/if}

	{#if data.specs.length === 0}
		<div class="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
			<p class="text-gray-600">
				No exam specifications found. Run the seed script to populate specifications.
			</p>
		</div>
	{:else if filteredSpecs.length === 0}
		<div class="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
			<p class="text-gray-600">No specifications match the selected filter.</p>
		</div>
	{:else}
		{#each Object.entries(specsByLevel) as [level, specs] (level)}
			<div class="mb-8">
				<h2 class="mb-4 text-2xl font-semibold">{level}</h2>
				<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{#each specs as spec (spec.id)}
						<a
							href={resolve(`/specifications/${spec.id}`)}
							data-sveltekit-preload-data
							class="block rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
						>
							<h3 class="mb-2 text-xl font-semibold">{spec.board}</h3>
							<p class="mb-3 text-sm text-gray-600">{spec.name}</p>
							<div class="space-y-1 text-sm text-gray-600">
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
