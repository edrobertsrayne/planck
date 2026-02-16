<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	import Button from '$lib/components/ui/button/button.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import Textarea from '$lib/components/ui/textarea/textarea.svelte';
	import Label from '$lib/components/ui/label/label.svelte';
	import * as Alert from '$lib/components/ui/alert';
	import { BookOpen } from 'lucide-svelte';

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

<div class="container mx-auto p-4 sm:p-6">
	<div class="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
		<h1 class="text-2xl font-bold sm:text-3xl">Module Library</h1>
		<Button
			onclick={() => (showCreateForm = !showCreateForm)}
			class="min-h-[44px] w-full sm:w-auto"
		>
			{showCreateForm ? 'Cancel' : 'Create New Module'}
		</Button>
	</div>

	{#if form?.success}
		<Alert.Root class="mb-4">
			<Alert.Title>Success</Alert.Title>
			<Alert.Description>Module created successfully!</Alert.Description>
		</Alert.Root>
	{/if}

	{#if form?.error}
		<Alert.Root variant="destructive" class="mb-4">
			<Alert.Title>Error</Alert.Title>
			<Alert.Description>{form.error}</Alert.Description>
		</Alert.Root>
	{/if}

	{#if !showCreateForm && data.modules.length > 0}
		<div class="mb-4 flex flex-col gap-2 sm:mb-6 sm:flex-row sm:items-center sm:gap-4">
			<Label for="specFilter">Filter by Target Specification:</Label>
			<select
				id="specFilter"
				bind:value={filterSpecId}
				class="min-h-[44px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none sm:w-auto"
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
					<Label for="name">
						Module Name <span class="text-red-500">*</span>
					</Label>
					<Input
						type="text"
						id="name"
						name="name"
						bind:value={name}
						placeholder="e.g., Forces and Motion"
						required
						class="mt-2"
					/>
				</div>

				<div>
					<Label for="description">Description</Label>
					<Textarea
						id="description"
						name="description"
						bind:value={description}
						rows={3}
						placeholder="Optional overview of the module"
						class="mt-2"
					/>
				</div>

				<div>
					<Label for="targetSpecId">Target Specification</Label>
					<select
						id="targetSpecId"
						name="targetSpecId"
						bind:value={targetSpecId}
						class="mt-2 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
					>
						<option value="">None (generic module)</option>
						{#each data.examSpecs as spec (spec.id)}
							<option value={spec.id}>{spec.name}</option>
						{/each}
					</select>
					<p class="mt-1 text-sm text-muted-foreground">
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
		<div
			class="bg-background-subtle flex flex-col items-center justify-center rounded-lg border border-border p-12 text-center"
		>
			<BookOpen class="mb-4 h-12 w-12 text-muted-foreground" />
			<h3 class="font-display mb-2 text-xl font-semibold">No modules yet</h3>
			<p class="mb-4 max-w-sm text-sm text-muted-foreground">
				Create your first module to organize lessons into teaching units. Modules can be reused
				across multiple classes.
			</p>
			<Button onclick={() => (showCreateForm = true)}>Create Your First Module</Button>
		</div>
	{:else if filteredModules.length === 0}
		<div
			class="bg-background-subtle flex flex-col items-center justify-center rounded-lg border border-border p-12 text-center"
		>
			<BookOpen class="mb-4 h-12 w-12 text-muted-foreground" />
			<h3 class="font-display mb-2 text-xl font-semibold">No modules match</h3>
			<p class="mb-4 max-w-sm text-sm text-muted-foreground">
				No modules found for the selected specification. Try changing the filter or create a new
				module.
			</p>
			<Button variant="outline" onclick={() => (filterSpecId = null)}>Clear Filter</Button>
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
