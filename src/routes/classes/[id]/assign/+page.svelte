<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageData, ActionData } from './$types';
	import Button from '$lib/components/ui/button/button.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let moduleId = $state('');
	let useNextAvailable = $state(true);
	let startDate = $state('');

	// Get today's date in YYYY-MM-DD format for the min attribute
	const today = new Date().toISOString().split('T')[0];
</script>

<div class="container mx-auto p-6">
	<div class="mb-6">
		<a href={resolve(`/classes/${data.class.id}`)} class="text-indigo-600 hover:text-indigo-800">
			← Back to {data.class.name}
		</a>
	</div>

	<h1 class="mb-6 text-3xl font-bold">Assign Module to {data.class.name}</h1>

	{#if form?.error}
		<div class="mb-4 rounded-md bg-red-50 p-4 text-red-800">
			{form.error}
		</div>
	{/if}

	<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
		<form method="POST" action="?/assign" use:enhance class="space-y-6">
			<!-- Module Selection -->
			<div>
				<label for="moduleId" class="mb-2 block text-sm font-medium text-gray-700">
					Select Module <span class="text-red-500">*</span>
				</label>
				<select
					id="moduleId"
					name="moduleId"
					bind:value={moduleId}
					required
					class="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
				>
					<option value="">Choose a module...</option>
					{#each data.modules as module (module.id)}
						<option value={module.id}>
							{module.name}
							{#if module.targetSpec}
								• {module.targetSpec.board} {module.targetSpec.level}
							{/if}
						</option>
					{/each}
				</select>
				{#if moduleId}
					{@const selectedModule = data.modules.find((m) => m.id === moduleId)}
					{#if selectedModule?.description}
						<p class="mt-2 text-sm text-gray-600">
							{selectedModule.description}
						</p>
					{/if}
				{/if}
			</div>

			<!-- Start Point Selection -->
			<div class="space-y-3">
				<label class="block text-sm font-medium text-gray-700">Start Point</label>

				<div class="space-y-2">
					<!-- Next Available Option -->
					<label
						class="flex cursor-pointer items-center gap-3 rounded-md border border-gray-200 p-3 hover:bg-gray-50 {useNextAvailable
							? 'border-indigo-500 bg-indigo-50'
							: ''}"
					>
						<input
							type="radio"
							name="startOption"
							value="next"
							bind:group={useNextAvailable}
							onchange={() => (useNextAvailable = true)}
							class="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
						/>
						<div>
							<div class="font-medium text-gray-900">Next Available Slot</div>
							<div class="text-sm text-gray-600">
								Automatically schedule from the next free timetable slot
							</div>
						</div>
					</label>

					<!-- Specific Date Option -->
					<label
						class="flex cursor-pointer items-center gap-3 rounded-md border border-gray-200 p-3 hover:bg-gray-50 {!useNextAvailable
							? 'border-indigo-500 bg-indigo-50'
							: ''}"
					>
						<input
							type="radio"
							name="startOption"
							value="date"
							bind:group={useNextAvailable}
							onchange={() => (useNextAvailable = false)}
							class="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
						/>
						<div class="flex-1">
							<div class="font-medium text-gray-900">Specific Date</div>
							<div class="mb-2 text-sm text-gray-600">
								Choose a specific start date for the module
							</div>
							{#if !useNextAvailable}
								<input
									type="date"
									id="startDate"
									name="startDate"
									bind:value={startDate}
									min={today}
									required={!useNextAvailable}
									class="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
								/>
							{/if}
						</div>
					</label>
				</div>

				<input type="hidden" name="useNextAvailable" value={useNextAvailable.toString()} />
			</div>

			<!-- Submit Buttons -->
			<div class="flex gap-3 pt-4">
				<Button type="submit" disabled={!moduleId}>Assign Module</Button>
				<Button type="button" variant="outline" onclick={() => window.history.back()}>
					Cancel
				</Button>
			</div>
		</form>
	</div>

	{#if data.modules.length === 0}
		<div class="mt-6 rounded-md bg-yellow-50 p-4 text-yellow-800">
			<p class="font-medium">No modules available</p>
			<p class="mt-1 text-sm">
				You need to create modules in the <a href={resolve('/modules')} class="underline"
					>Module Library</a
				> before you can assign them to classes.
			</p>
		</div>
	{/if}
</div>
