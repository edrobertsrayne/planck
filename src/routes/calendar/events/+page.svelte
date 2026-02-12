<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	import Button from '$lib/components/ui/button/button.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let showCreateForm = $state(false);
	let type = $state<'holiday' | 'closure' | 'absence'>('holiday');
	let title = $state('');
	let startDate = $state('');
	let endDate = $state('');
	let affectsAllClasses = $state(true);

	function resetForm() {
		showCreateForm = false;
		type = 'holiday';
		title = '';
		startDate = '';
		endDate = '';
		affectsAllClasses = true;
	}

	$effect(() => {
		if (form?.success && !form?.deleted) {
			resetForm();
		}
	});

	function formatDate(date: Date): string {
		return new Date(date).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	function getEventTypeLabel(eventType: 'holiday' | 'closure' | 'absence'): string {
		const labels = {
			holiday: 'Holiday',
			closure: 'School Closure',
			absence: 'Teacher Absence'
		};
		return labels[eventType];
	}

	function getEventTypeColor(eventType: 'holiday' | 'closure' | 'absence'): string {
		const colors = {
			holiday: 'bg-blue-100 text-blue-800 border-blue-300',
			closure: 'bg-orange-100 text-orange-800 border-orange-300',
			absence: 'bg-purple-100 text-purple-800 border-purple-300'
		};
		return colors[eventType];
	}
</script>

<div class="container mx-auto p-6">
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold">Calendar Events</h1>
			<p class="mt-2 text-gray-600">Manage holidays, school closures, and teacher absences</p>
		</div>
		<Button onclick={() => (showCreateForm = !showCreateForm)}>
			{showCreateForm ? 'Cancel' : 'Add Event'}
		</Button>
	</div>

	{#if form?.success && !form?.deleted}
		<div class="mb-4 rounded-md bg-green-50 p-4 text-green-800">Event created successfully!</div>
	{/if}

	{#if form?.success && form?.deleted}
		<div class="mb-4 rounded-md bg-green-50 p-4 text-green-800">Event deleted successfully!</div>
	{/if}

	{#if form?.error}
		<div class="mb-4 rounded-md bg-red-50 p-4 text-red-800">
			{form.error}
		</div>
	{/if}

	{#if showCreateForm}
		<div class="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
			<h2 class="mb-4 text-xl font-semibold">Add Calendar Event</h2>
			<form method="POST" action="?/create" use:enhance>
				<div class="grid gap-4">
					<div>
						<label for="type" class="mb-1 block text-sm font-medium text-gray-700">
							Event Type
						</label>
						<select
							id="type"
							name="type"
							bind:value={type}
							required
							class="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
						>
							<option value="holiday">Holiday (Term Break, Bank Holiday)</option>
							<option value="closure">School Closure (INSET Day, Snow Day)</option>
							<option value="absence">Teacher Absence</option>
						</select>
					</div>

					<div>
						<label for="title" class="mb-1 block text-sm font-medium text-gray-700">
							Event Title
						</label>
						<input
							type="text"
							id="title"
							name="title"
							bind:value={title}
							required
							placeholder="e.g., Half Term, INSET Day, Personal Absence"
							class="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
						/>
					</div>

					<div class="grid gap-4 md:grid-cols-2">
						<div>
							<label for="startDate" class="mb-1 block text-sm font-medium text-gray-700">
								Start Date
							</label>
							<input
								type="date"
								id="startDate"
								name="startDate"
								bind:value={startDate}
								required
								class="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
							/>
						</div>

						<div>
							<label for="endDate" class="mb-1 block text-sm font-medium text-gray-700">
								End Date
							</label>
							<input
								type="date"
								id="endDate"
								name="endDate"
								bind:value={endDate}
								required
								class="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
							/>
						</div>
					</div>

					<div class="flex items-center gap-2">
						<input
							type="checkbox"
							id="affectsAllClasses"
							name="affectsAllClasses"
							bind:checked={affectsAllClasses}
							value="true"
							class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
						/>
						<label for="affectsAllClasses" class="text-sm text-gray-700">
							Affects all classes
						</label>
					</div>

					<div class="flex justify-end gap-3">
						<Button type="button" variant="outline" onclick={resetForm}>Cancel</Button>
						<Button type="submit">Create Event</Button>
					</div>
				</div>
			</form>
		</div>
	{/if}

	<div class="rounded-lg border border-gray-200 bg-white shadow-sm">
		{#if data.events.length === 0}
			<div class="p-8 text-center text-gray-500">
				<p>No calendar events yet.</p>
				<p class="mt-2 text-sm">
					Add holidays, closures, and absences to automatically manage lesson scheduling.
				</p>
			</div>
		{:else}
			<div class="divide-y divide-gray-200">
				{#each data.events as event (event.id)}
					<div class="p-4 hover:bg-gray-50">
						<div class="flex items-start justify-between">
							<div class="flex-1">
								<div class="mb-2 flex items-center gap-2">
									<span
										class="inline-block rounded-md border px-2 py-1 text-xs font-medium {getEventTypeColor(
											event.type
										)}"
									>
										{getEventTypeLabel(event.type)}
									</span>
									{#if event.affectsAllClasses}
										<span
											class="inline-block rounded-md border border-gray-300 bg-gray-100 px-2 py-1 text-xs text-gray-700"
										>
											All Classes
										</span>
									{/if}
								</div>
								<h3 class="font-medium text-gray-900">{event.title}</h3>
								<p class="mt-1 text-sm text-gray-600">
									{formatDate(event.startDate)}
									{#if event.startDate.getTime() !== event.endDate.getTime()}
										- {formatDate(event.endDate)}
									{/if}
								</p>
							</div>
							<form method="POST" action="?/delete" use:enhance>
								<input type="hidden" name="id" value={event.id} />
								<Button
									type="submit"
									variant="outline"
									size="sm"
									onclick={(e: MouseEvent) => {
										if (!confirm('Are you sure you want to delete this event?')) {
											e.preventDefault();
										}
									}}
								>
									Delete
								</Button>
							</form>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
