<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	import Button from '$lib/components/ui/button/button.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import Textarea from '$lib/components/ui/textarea/textarea.svelte';
	import Label from '$lib/components/ui/label/label.svelte';
	import * as Alert from '$lib/components/ui/alert';
	import { getKeyStageColor, getKeyStageLabel } from '$lib/utils/key-stage-colors';
	import { GraduationCap } from 'lucide-svelte';

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

<div class="container mx-auto p-4 sm:p-6">
	<div class="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
		<h1 class="text-2xl font-bold sm:text-3xl">Classes</h1>
		<Button
			onclick={() => (showCreateForm = !showCreateForm)}
			class="min-h-[44px] w-full sm:w-auto"
		>
			{showCreateForm ? 'Cancel' : 'Create New Class'}
		</Button>
	</div>

	{#if form?.success}
		<Alert.Root class="mb-4">
			<Alert.Title>Success</Alert.Title>
			<Alert.Description>Class created successfully!</Alert.Description>
		</Alert.Root>
	{/if}

	{#if form?.error}
		<Alert.Root variant="destructive" class="mb-4">
			<Alert.Title>Error</Alert.Title>
			<Alert.Description>{form.error}</Alert.Description>
		</Alert.Root>
	{/if}

	{#if !showCreateForm && data.classes.length > 0}
		<div class="mb-4 flex flex-col gap-2 sm:mb-6 sm:flex-row sm:items-center sm:gap-4">
			<Label for="yearGroupFilter">Filter by Year Group:</Label>
			<select
				id="yearGroupFilter"
				bind:value={filterYearGroup}
				class="min-h-[44px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none sm:w-auto"
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
						<Label for="name">
							Class Name <span class="text-red-500">*</span>
						</Label>
						<Input
							type="text"
							id="name"
							name="name"
							bind:value={name}
							placeholder="e.g., 11X/Ph1, Year 12 Physics"
							required
							class="mt-2"
						/>
					</div>

					<div>
						<Label for="yearGroup">
							Year Group <span class="text-red-500">*</span>
						</Label>
						<select
							id="yearGroup"
							name="yearGroup"
							bind:value={yearGroup}
							required
							class="mt-2 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
						>
							{#each [7, 8, 9, 10, 11, 12, 13] as year (year)}
								<option value={year}>Year {year}</option>
							{/each}
						</select>
					</div>

					<div>
						<Label for="examSpecId">
							Exam Specification <span class="text-red-500">*</span>
						</Label>
						<select
							id="examSpecId"
							name="examSpecId"
							bind:value={examSpecId}
							required
							class="mt-2 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
						>
							<option value="">Select a specification...</option>
							{#each data.examSpecs as spec (spec.id)}
								<option value={spec.id}>{spec.name}</option>
							{/each}
						</select>
					</div>

					<div>
						<Label for="academicYear">
							Academic Year <span class="text-red-500">*</span>
						</Label>
						<Input
							type="text"
							id="academicYear"
							name="academicYear"
							bind:value={academicYear}
							placeholder="e.g., 2024-25"
							required
							class="mt-2"
						/>
						<p class="mt-1 text-sm text-muted-foreground">Format: YYYY-YY</p>
					</div>

					<div>
						<Label for="studentCount">Student Count</Label>
						<Input
							type="number"
							id="studentCount"
							name="studentCount"
							bind:value={studentCount}
							placeholder="Optional"
							min="1"
							class="mt-2"
						/>
					</div>

					<div>
						<Label for="room">Room</Label>
						<Input
							type="text"
							id="room"
							name="room"
							bind:value={room}
							placeholder="e.g., Lab 3"
							class="mt-2"
						/>
					</div>
				</div>

				<div>
					<Label for="notes">Notes</Label>
					<Textarea
						id="notes"
						name="notes"
						bind:value={notes}
						rows={3}
						placeholder="Optional notes about the class"
						class="mt-2"
					/>
				</div>

				<div class="flex justify-end gap-2">
					<Button type="button" variant="outline" onclick={resetForm}>Cancel</Button>
					<Button type="submit">Create Class</Button>
				</div>
			</form>
		</div>
	{/if}

	{#if data.classes.length === 0}
		<div
			class="bg-background-subtle flex flex-col items-center justify-center rounded-lg border border-border p-12 text-center"
		>
			<GraduationCap class="mb-4 h-12 w-12 text-muted-foreground" />
			<h3 class="font-display mb-2 text-xl font-semibold">No classes yet</h3>
			<p class="mb-4 max-w-sm text-sm text-muted-foreground">
				Get started by creating your first class. You'll be able to assign modules and schedule
				lessons.
			</p>
			<Button onclick={() => (showCreateForm = true)}>Create Your First Class</Button>
		</div>
	{:else if filteredClasses.length === 0}
		<div
			class="bg-background-subtle flex flex-col items-center justify-center rounded-lg border border-border p-12 text-center"
		>
			<GraduationCap class="mb-4 h-12 w-12 text-muted-foreground" />
			<h3 class="font-display mb-2 text-xl font-semibold">No classes match</h3>
			<p class="mb-4 max-w-sm text-sm text-muted-foreground">
				No classes found for the selected year group. Try changing the filter or create a new class.
			</p>
			<Button variant="outline" onclick={() => (filterYearGroup = null)}>Clear Filter</Button>
		</div>
	{:else}
		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{#each filteredClasses as classItem (classItem.id)}
				<a
					href="/classes/{classItem.id}"
					data-sveltekit-preload-data
					class="dark:bg-surface block rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-border"
				>
					<div class="mb-3 flex items-center gap-2">
						<div
							class="h-8 w-1 rounded-full"
							style="background-color: {getKeyStageColor(classItem.yearGroup)}"
							aria-hidden="true"
						></div>
						<h3 class="text-xl font-semibold">{classItem.name}</h3>
						{#if getKeyStageLabel(classItem.yearGroup)}
							<span
								class="ml-auto rounded-full px-2 py-1 text-xs font-medium"
								style="background-color: {getKeyStageColor(
									classItem.yearGroup
								)}20; color: {getKeyStageColor(classItem.yearGroup)}"
							>
								{getKeyStageLabel(classItem.yearGroup)}
							</span>
						{/if}
					</div>
					<div class="space-y-1 text-sm text-muted-foreground">
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
