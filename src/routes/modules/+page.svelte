<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	import Button from '$lib/components/ui/button/button.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let showCreateForm = $state(false);
	let filterSpecId = $state<string | null>(null);
	let name = $state('');
	let description = $state('');
	let targetSpecId = $state('');

	// Filtered modules based on target spec filter
	let filteredModules = $derived(
		filterSpecId === null
			? data.modules
			: data.modules.filter((m) => m.targetSpecId === filterSpecId)
	);

	function resetForm() {
		showCreateForm = false;
		name = '';
		description = '';
		targetSpecId = '';
	}

	$effect(() => {
		if (form?.success) {
			resetForm();
		}
	});
</script>

<div class="container mx-auto p-6">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-3xl font-bold">Module Library</h1>
		<Button onclick={() => (showCreateForm = !showCreateForm)}>
			{showCreateForm ? 'Cancel' : 'Create New Module'}
		</Button>
	</div>

	{#if form?.success}
		<div class="mb-4 rounded-md bg-green-50 p-4 text-green-800">Module created successfully!</div>
	{/if}

	{#if form?.error}
		<div class="mb-4 rounded-md bg-red-50 p-4 text-red-800">
			{form.error}
		</div>
	{/if}

	{#if !showCreateForm && data.modules.length > 0}
		<div class="mb-6 flex items-center gap-4">
			<label for="specFilter" class="text-sm font-medium text-gray-700">
				Filter by Target Specification:
			</label>
			<select
				id="specFilter"
				bind:value={filterSpecId}
				class="rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
			>
				<option value={null}>All Specifications</option>
				{#each data.examSpecs as spec (spec.id)}
					<option value={spec.id}>{spec.name}</option>
				{/each}
			</select>
		</div>
	{/if}

	{#if showCreateForm}
		<div class="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
			<h2 class="mb-4 text-xl font-semibold">Create New Module</h2>
			<form method="POST" action="?/create" use:enhance class="space-y-4">
				<div>
					<label for="name" class="mb-2 block text-sm font-medium text-gray-700">
						Module Name <span class="text-red-500">*</span>
					</label>
					<input
						type="text"
						id="name"
						name="name"
						bind:value={name}
						placeholder="e.g., Forces and Motion"
						required
						class="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
					/>
				</div>

				<div>
					<label for="description" class="mb-2 block text-sm font-medium text-gray-700">
						Description
					</label>
					<textarea
						id="description"
						name="description"
						bind:value={description}
						rows="3"
						placeholder="Optional overview of the module"
						class="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
					></textarea>
				</div>

				<div>
					<label for="targetSpecId" class="mb-2 block text-sm font-medium text-gray-700">
						Target Specification
					</label>
					<select
						id="targetSpecId"
						name="targetSpecId"
						bind:value={targetSpecId}
						class="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
					>
						<option value="">None (generic module)</option>
						{#each data.examSpecs as spec (spec.id)}
							<option value={spec.id}>{spec.name}</option>
						{/each}
					</select>
					<p class="mt-1 text-sm text-gray-500">
						Which exam specification is this module designed for?
					</p>
				</div>

				<div class="flex justify-end gap-2">
					<Button type="button" variant="outline" onclick={resetForm}>Cancel</Button>
					<Button type="submit">Create Module</Button>
				</div>
			</form>
		</div>
	{/if}

	{#if data.modules.length === 0}
		<div class="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
			<p class="text-gray-600">
				No modules yet. Click "Create New Module" to add your first module.
			</p>
		</div>
	{:else if filteredModules.length === 0}
		<div class="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
			<p class="text-gray-600">No modules match the selected filter.</p>
		</div>
	{:else}
		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{#each filteredModules as moduleItem (moduleItem.id)}
				<a
					href="/modules/{moduleItem.id}"
					data-sveltekit-preload-data
					class="block rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
				>
					<h3 class="mb-2 text-xl font-semibold">{moduleItem.name}</h3>
					{#if moduleItem.description}
						<p class="mb-3 text-sm text-gray-600">{moduleItem.description}</p>
					{/if}
					<div class="space-y-1 text-sm text-gray-600">
						<p>
							<span class="font-medium">Target Spec:</span>
							{moduleItem.targetSpec?.name || 'Generic'}
						</p>
						<p>
							<span class="font-medium">Lessons:</span>
							{moduleItem.lessonCount}
						</p>
						<p>
							<span class="font-medium">Assigned to:</span>
							{moduleItem.assignmentCount}
							{moduleItem.assignmentCount === 1 ? 'class' : 'classes'}
						</p>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>
