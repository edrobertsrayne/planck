<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	import Button from '$lib/components/ui/button/button.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import Label from '$lib/components/ui/label/label.svelte';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import * as Card from '$lib/components/ui/card';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let academicYear = $state('');
	let weeks = $state(1);
	let periodsPerDay = $state(6);
	let daysPerWeek = $state(5);

	$effect(() => {
		academicYear = data.config?.academicYear || '';
		weeks = data.globalConfig?.weeks || 1;
		periodsPerDay = data.config?.periodsPerDay || 6;
		daysPerWeek = data.config?.daysPerWeek || 5;
	});
</script>

<div class="container mx-auto max-w-3xl p-4 sm:p-6">
	<h1 class="mb-4 text-2xl font-bold sm:mb-6 sm:text-3xl">Timetable Configuration</h1>

	{#if form?.success}
		<Alert.Root class="mb-4">
			<Alert.Description>Configuration saved successfully!</Alert.Description>
		</Alert.Root>
	{/if}

	{#if form?.error}
		<Alert.Root variant="destructive" class="mb-4">
			<Alert.Description>{form.error}</Alert.Description>
		</Alert.Root>
	{/if}

	<form method="POST" action="?/save" use:enhance class="space-y-6">
		<!-- School-wide Settings -->
		<Card.Root>
			<Card.Header>
				<Card.Title>School-wide Settings</Card.Title>
				<Card.Description>
					These settings apply to all academic years across your school
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<div>
					<Label for="weeks">Timetable Type</Label>
					<select
						id="weeks"
						name="weeks"
						bind:value={weeks}
						class="mt-2 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
					>
						<option value={1}>1-week timetable</option>
						<option value={2}>2-week timetable (Week A/B)</option>
					</select>
					<p class="mt-1 text-sm text-muted-foreground">
						Choose whether your school operates on a 1-week or 2-week timetable cycle. This setting
						applies to all academic years.
					</p>
				</div>
			</Card.Content>
		</Card.Root>

		<!-- Year-specific Settings -->
		<Card.Root>
			<Card.Header>
				<Card.Title>Year-specific Settings</Card.Title>
				<Card.Description>
					These settings can vary by academic year and define the structure of your timetable
				</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div>
					<Label for="academicYear">Academic Year</Label>
					<Input
						type="text"
						id="academicYear"
						name="academicYear"
						bind:value={academicYear}
						placeholder="e.g., 2024-25"
						required
						class="mt-2"
					/>
					<p class="mt-1 text-sm text-muted-foreground">Format: YYYY-YY (e.g., 2024-25)</p>
				</div>

				<div>
					<Label for="periodsPerDay">Periods per Day</Label>
					<Input
						type="number"
						id="periodsPerDay"
						name="periodsPerDay"
						bind:value={periodsPerDay}
						min="1"
						max="10"
						required
						class="mt-2"
					/>
					<p class="mt-1 text-sm text-muted-foreground">
						Number of teaching periods per day (1-10)
					</p>
				</div>

				<div>
					<Label for="daysPerWeek">Days per Week</Label>
					<Input
						type="number"
						id="daysPerWeek"
						name="daysPerWeek"
						bind:value={daysPerWeek}
						min="1"
						max="7"
						required
						class="mt-2"
					/>
					<p class="mt-1 text-sm text-muted-foreground">
						Number of teaching days per week (typically 5 for Mon-Fri)
					</p>
				</div>
			</Card.Content>
		</Card.Root>

		<div class="flex justify-end">
			<Button type="submit">Save Configuration</Button>
		</div>
	</form>
</div>
