<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageData, ActionData } from './$types';
	import Button from '$lib/components/ui/button/button.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import Label from '$lib/components/ui/label/label.svelte';
	import * as Alert from '$lib/components/ui/alert/index.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let moduleId = $state('');
	let useNextAvailable = $state(true);
	let startDate = $state('');

	// Get today's date in YYYY-MM-DD format for the min attribute
	const today = new Date().toISOString().split('T')[0];
</script>

<div class="container mx-auto p-6">
	<div class="mb-6">
		<a
			href={resolve(`/classes/${data.class.id}`)}
			class="text-accent-secondary hover:text-accent-secondary-hover"
		>
			← Back to {data.class.name}
		</a>
	</div>

	<h1 class="mb-6 text-3xl font-bold">Assign Module to {data.class.name}</h1>

	{#if form?.error}
		<Alert.Root variant="destructive" class="mb-4">
			<Alert.Description>{form.error}</Alert.Description>
		</Alert.Root>
	{/if}

	<div class="rounded-lg border border-border bg-surface p-6 shadow-sm">
		<form method="POST" action="?/assign" use:enhance class="space-y-6">
			<!-- Module Selection -->
			<div>
				<Label for="moduleId">
					Select Module <span class="text-red-500">*</span>
				</Label>
				<select
					id="moduleId"
					name="moduleId"
					bind:value={moduleId}
					required
					class="mt-2 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
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
						<p class="mt-2 text-sm text-muted-foreground">
							{selectedModule.description}
						</p>
					{/if}
				{/if}
			</div>

			<!-- Start Point Selection -->
			<fieldset class="space-y-3">
				<Label class="text-sm">Start Point</Label>

				<div class="space-y-2">
					<!-- Next Available Option -->
					<label
						class="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3 hover:bg-background-subtle {useNextAvailable
							? 'border-accent-secondary bg-accent-secondary-muted'
							: ''}"
					>
						<input
							type="radio"
							name="startOption"
							value="next"
							bind:group={useNextAvailable}
							onchange={() => (useNextAvailable = true)}
							class="h-4 w-4 text-accent-secondary focus:ring-accent-secondary"
						/>
						<div>
							<div class="font-medium">Next Available Slot</div>
							<div class="text-sm text-muted-foreground">
								Automatically schedule from the next free timetable slot
							</div>
						</div>
					</label>

					<!-- Specific Date Option -->
					<label
						class="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3 hover:bg-background-subtle {!useNextAvailable
							? 'border-accent-secondary bg-accent-secondary-muted'
							: ''}"
					>
						<input
							type="radio"
							name="startOption"
							value="date"
							bind:group={useNextAvailable}
							onchange={() => (useNextAvailable = false)}
							class="h-4 w-4 text-accent-secondary focus:ring-accent-secondary"
						/>
						<div class="flex-1">
							<div class="font-medium">Specific Date</div>
							<div class="mb-2 text-sm text-muted-foreground">
								Choose a specific start date for the module
							</div>
							{#if !useNextAvailable}
								<Input
									type="date"
									id="startDate"
									name="startDate"
									bind:value={startDate}
									min={today}
									required={!useNextAvailable}
									class="text-sm"
								/>
							{/if}
						</div>
					</label>
				</div>

				<input type="hidden" name="useNextAvailable" value={useNextAvailable.toString()} />
			</fieldset>

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
