<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	import Button from '$lib/components/ui/button/button.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let showCreateForm = $state(false);
	let filterYearGroup = $state<number | null>(null);
	let name = $state('');
	let yearGroup = $state(11);
	let examSpecId = $state('');
	let academicYear = $state('');
	let studentCount = $state('');
	let room = $state('');
	let notes = $state('');

	// Filtered classes based on year group filter
	let filteredClasses = $derived(
		filterYearGroup === null
			? data.classes
			: data.classes.filter((c) => c.yearGroup === filterYearGroup)
	);

	function resetForm() {
		showCreateForm = false;
		name = '';
		yearGroup = 11;
		examSpecId = '';
		academicYear = '';
		studentCount = '';
		room = '';
		notes = '';
	}

	$effect(() => {
		if (form?.success) {
			resetForm();
		}
	});
</script>

<div class="container mx-auto p-6">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-3xl font-bold">Classes</h1>
		<Button onclick={() => (showCreateForm = !showCreateForm)}>
			{showCreateForm ? 'Cancel' : 'Create New Class'}
		</Button>
	</div>

	{#if form?.success}
		<div class="mb-4 rounded-md bg-green-50 p-4 text-green-800">Class created successfully!</div>
	{/if}

	{#if form?.error}
		<div class="mb-4 rounded-md bg-red-50 p-4 text-red-800">
			{form.error}
		</div>
	{/if}

	{#if !showCreateForm && data.classes.length > 0}
		<div class="mb-6 flex items-center gap-4">
			<label for="yearGroupFilter" class="text-sm font-medium text-gray-700">
				Filter by Year Group:
			</label>
			<select
				id="yearGroupFilter"
				bind:value={filterYearGroup}
				class="rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
			>
				<option value={null}>All Year Groups</option>
				{#each [7, 8, 9, 10, 11, 12, 13] as year (year)}
					<option value={year}>Year {year}</option>
				{/each}
			</select>
		</div>
	{/if}

	{#if showCreateForm}
		<div class="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
			<h2 class="mb-4 text-xl font-semibold">Create New Class</h2>
			<form method="POST" action="?/create" use:enhance class="space-y-4">
				<div class="grid gap-4 md:grid-cols-2">
					<div>
						<label for="name" class="mb-2 block text-sm font-medium text-gray-700">
							Class Name <span class="text-red-500">*</span>
						</label>
						<input
							type="text"
							id="name"
							name="name"
							bind:value={name}
							placeholder="e.g., 11X/Ph1, Year 12 Physics"
							required
							class="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
						/>
					</div>

					<div>
						<label for="yearGroup" class="mb-2 block text-sm font-medium text-gray-700">
							Year Group <span class="text-red-500">*</span>
						</label>
						<select
							id="yearGroup"
							name="yearGroup"
							bind:value={yearGroup}
							required
							class="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
						>
							{#each [7, 8, 9, 10, 11, 12, 13] as year (year)}
								<option value={year}>Year {year}</option>
							{/each}
						</select>
					</div>

					<div>
						<label for="examSpecId" class="mb-2 block text-sm font-medium text-gray-700">
							Exam Specification <span class="text-red-500">*</span>
						</label>
						<select
							id="examSpecId"
							name="examSpecId"
							bind:value={examSpecId}
							required
							class="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
						>
							<option value="">Select a specification...</option>
							{#each data.examSpecs as spec (spec.id)}
								<option value={spec.id}>{spec.name}</option>
							{/each}
						</select>
					</div>

					<div>
						<label for="academicYear" class="mb-2 block text-sm font-medium text-gray-700">
							Academic Year <span class="text-red-500">*</span>
						</label>
						<input
							type="text"
							id="academicYear"
							name="academicYear"
							bind:value={academicYear}
							placeholder="e.g., 2024-25"
							required
							class="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
						/>
						<p class="mt-1 text-sm text-gray-500">Format: YYYY-YY</p>
					</div>

					<div>
						<label for="studentCount" class="mb-2 block text-sm font-medium text-gray-700">
							Student Count
						</label>
						<input
							type="number"
							id="studentCount"
							name="studentCount"
							bind:value={studentCount}
							placeholder="Optional"
							min="1"
							class="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
						/>
					</div>

					<div>
						<label for="room" class="mb-2 block text-sm font-medium text-gray-700"> Room </label>
						<input
							type="text"
							id="room"
							name="room"
							bind:value={room}
							placeholder="e.g., Lab 3"
							class="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
						/>
					</div>
				</div>

				<div>
					<label for="notes" class="mb-2 block text-sm font-medium text-gray-700"> Notes </label>
					<textarea
						id="notes"
						name="notes"
						bind:value={notes}
						rows="3"
						placeholder="Optional notes about the class"
						class="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
					></textarea>
				</div>

				<div class="flex justify-end gap-2">
					<Button type="button" variant="outline" onclick={resetForm}>Cancel</Button>
					<Button type="submit">Create Class</Button>
				</div>
			</form>
		</div>
	{/if}

	{#if data.classes.length === 0}
		<div class="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
			<p class="text-gray-600">No classes yet. Click "Create New Class" to add your first class.</p>
		</div>
	{:else if filteredClasses.length === 0}
		<div class="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
			<p class="text-gray-600">No classes match the selected filter.</p>
		</div>
	{:else}
		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{#each filteredClasses as classItem (classItem.id)}
				<a
					href="/classes/{classItem.id}"
					data-sveltekit-preload-data
					class="block rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
				>
					<h3 class="mb-2 text-xl font-semibold">{classItem.name}</h3>
					<div class="space-y-1 text-sm text-gray-600">
						<p>
							<span class="font-medium">Year Group:</span>
							{classItem.yearGroup}
						</p>
						<p>
							<span class="font-medium">Exam Spec:</span>
							{classItem.examSpec?.name || 'N/A'}
						</p>
						<p>
							<span class="font-medium">Academic Year:</span>
							{classItem.academicYear}
						</p>
						{#if classItem.studentCount}
							<p>
								<span class="font-medium">Students:</span>
								{classItem.studentCount}
							</p>
						{/if}
						{#if classItem.room}
							<p>
								<span class="font-medium">Room:</span>
								{classItem.room}
							</p>
						{/if}
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>
