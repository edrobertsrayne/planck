<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { PageData, ActionData } from './$types';
	import Button from '$lib/components/ui/button/button.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import Label from '$lib/components/ui/label/label.svelte';
	import * as Alert from '$lib/components/ui/alert/index.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let academicYear = $derived(data.academicYear || '');
	let editingEventId = $state<string | null>(null);
	let editTitle = $state('');
	let editStartDate = $state('');
	let editEndDate = $state('');

	function formatDate(date: Date): string {
		return date.toISOString().split('T')[0];
	}

	function startEditing(event: (typeof data.events)[0]) {
		editingEventId = event.id;
		editTitle = event.title;
		editStartDate = formatDate(event.startDate);
		editEndDate = formatDate(event.endDate);
	}

	function cancelEditing() {
		editingEventId = null;
		editTitle = '';
		editStartDate = '';
		editEndDate = '';
	}

	async function handleImport(event: Event) {
		const form = event.target as HTMLFormElement;
		const formData = new FormData(form);
		const year = formData.get('academicYear')?.toString();

		// Wait for the form to submit and then redirect to show the events
		setTimeout(() => {
			if (year) {
				// Note: We need to add query params after resolve(), which only works with pathnames
				// eslint-disable-next-line svelte/no-navigation-without-resolve
				goto(`${resolve('/settings/term-dates')}?year=${year}`);
			}
		}, 500);
	}
</script>

<div class="container mx-auto max-w-4xl p-4 sm:p-6">
	<h1 class="mb-4 text-2xl font-bold sm:mb-6 sm:text-3xl">Term Date Import</h1>

	{#if form?.success}
		<Alert.Root class="mb-4">
			<Alert.Description>{form.message || 'Operation completed successfully!'}</Alert.Description>
		</Alert.Root>
	{/if}

	{#if form?.error}
		<Alert.Root variant="destructive" class="mb-4">
			<Alert.Description>{form.error}</Alert.Description>
		</Alert.Root>
	{/if}

	<!-- Import Template Section -->
	<div class="mb-8 rounded-lg border border-border bg-surface p-6 shadow-sm">
		<h2 class="mb-4 text-xl font-semibold">Import UK Term Date Template</h2>
		<p class="mb-4 text-sm text-muted-foreground">
			Import a template of UK term dates including autumn, spring, and summer terms with half-term
			breaks and bank holidays. You can adjust individual dates after importing.
		</p>

		<form
			method="POST"
			action="?/import"
			use:enhance
			onsubmit={handleImport}
			class="flex flex-col gap-4 sm:flex-row sm:items-end"
		>
			<div class="flex-1">
				<Label for="academicYear">Academic Year</Label>
				<Input
					type="text"
					id="academicYear"
					name="academicYear"
					bind:value={academicYear}
					placeholder={`e.g., ${data.currentAcademicYear}`}
					required
					class="mt-2"
				/>
			</div>
			<Button type="submit">Import Template</Button>
		</form>
	</div>

	<!-- Display Imported Events -->
	{#if data.events.length > 0}
		<div class="rounded-lg border border-border bg-surface p-6 shadow-sm">
			<h2 class="mb-4 text-xl font-semibold">
				Term Dates for {data.academicYear}
			</h2>
			<p class="mb-4 text-sm text-muted-foreground">
				Review and adjust the imported term dates to match your school's calendar. Click "Edit" to
				modify individual dates.
			</p>

			<div class="space-y-3">
				{#each data.events as event (event.id)}
					{#if editingEventId === event.id}
						<!-- Edit Mode -->
						<form
							method="POST"
							action="?/update"
							use:enhance
							class="rounded-lg border border-accent-secondary bg-accent-secondary-muted p-4"
						>
							<input type="hidden" name="eventId" value={event.id} />

							<div class="mb-3 grid gap-3 sm:grid-cols-3">
								<div>
									<Label for="edit-title-{event.id}">Title</Label>
									<Input
										type="text"
										id="edit-title-{event.id}"
										name="title"
										bind:value={editTitle}
										required
										class="mt-2 text-sm"
									/>
								</div>
								<div>
									<Label for="edit-start-{event.id}">Start Date</Label>
									<Input
										type="date"
										id="edit-start-{event.id}"
										name="startDate"
										bind:value={editStartDate}
										required
										class="mt-2 text-sm"
									/>
								</div>
								<div>
									<Label for="edit-end-{event.id}">End Date</Label>
									<Input
										type="date"
										id="edit-end-{event.id}"
										name="endDate"
										bind:value={editEndDate}
										required
										class="mt-2 text-sm"
									/>
								</div>
							</div>

							<div class="flex gap-2">
								<Button type="submit" class="text-sm">Save</Button>
								<Button type="button" variant="outline" class="text-sm" onclick={cancelEditing}>
									Cancel
								</Button>
							</div>
						</form>
					{:else}
						<!-- View Mode -->
						<div
							class="flex flex-col gap-2 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
						>
							<div class="flex-1">
								<h3 class="font-medium">{event.title}</h3>
								<p class="text-sm text-muted-foreground">
									{formatDate(event.startDate)}
									{#if formatDate(event.endDate) !== formatDate(event.startDate)}
										→ {formatDate(event.endDate)}
									{/if}
									<span class="ml-2 text-xs text-muted-foreground">({event.type})</span>
								</p>
							</div>

							<div class="flex gap-2">
								<Button
									type="button"
									variant="outline"
									size="sm"
									onclick={() => startEditing(event)}
								>
									Edit
								</Button>

								<form method="POST" action="?/delete" use:enhance class="inline">
									<input type="hidden" name="eventId" value={event.id} />
									<Button
										type="submit"
										variant="destructive"
										size="sm"
										onclick={(e) => {
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
					{/if}
				{/each}
			</div>

			<div class="mt-6">
				<Button variant="outline" onclick={() => goto(resolve('/calendar/events'))}>
					Add Custom Events
				</Button>
			</div>
		</div>
	{:else if data.academicYear}
		<div class="rounded-lg border border-border bg-background-subtle p-6 text-center">
			<p class="text-muted-foreground">
				No term dates found for {data.academicYear}. Import the template above to get started.
			</p>
		</div>
	{/if}
</div>
