<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	import Button from '$lib/components/ui/button/button.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let academicYear = $state('');
	let weeks = $state(1);
	let periodsPerDay = $state(6);
	let daysPerWeek = $state(5);

	$effect(() => {
		academicYear = data.config?.academicYear || '';
		weeks = data.config?.weeks || 1;
		periodsPerDay = data.config?.periodsPerDay || 6;
		daysPerWeek = data.config?.daysPerWeek || 5;
	});
</script>

<div class="container mx-auto max-w-2xl p-6">
	<h1 class="mb-6 text-3xl font-bold">Timetable Configuration</h1>

	{#if form?.success}
		<div class="mb-4 rounded-md bg-green-50 p-4 text-green-800">
			Configuration saved successfully!
		</div>
	{/if}

	{#if form?.error}
		<div class="mb-4 rounded-md bg-red-50 p-4 text-red-800">
			{form.error}
		</div>
	{/if}

	<form method="POST" action="?/save" use:enhance class="space-y-6">
		<div>
			<label for="academicYear" class="mb-2 block text-sm font-medium text-gray-700">
				Academic Year
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
			<p class="mt-1 text-sm text-gray-500">Format: YYYY-YY (e.g., 2024-25)</p>
		</div>

		<div>
			<label for="weeks" class="mb-2 block text-sm font-medium text-gray-700">
				Timetable Type
			</label>
			<select
				id="weeks"
				name="weeks"
				bind:value={weeks}
				class="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
			>
				<option value={1}>1-week timetable</option>
				<option value={2}>2-week timetable (Week A/B)</option>
			</select>
			<p class="mt-1 text-sm text-gray-500">
				Choose whether your school operates on a 1-week or 2-week timetable cycle
			</p>
		</div>

		<div>
			<label for="periodsPerDay" class="mb-2 block text-sm font-medium text-gray-700">
				Periods per Day
			</label>
			<input
				type="number"
				id="periodsPerDay"
				name="periodsPerDay"
				bind:value={periodsPerDay}
				min="1"
				max="10"
				required
				class="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
			/>
			<p class="mt-1 text-sm text-gray-500">Number of teaching periods per day (1-10)</p>
		</div>

		<div>
			<label for="daysPerWeek" class="mb-2 block text-sm font-medium text-gray-700">
				Days per Week
			</label>
			<input
				type="number"
				id="daysPerWeek"
				name="daysPerWeek"
				bind:value={daysPerWeek}
				min="1"
				max="7"
				required
				class="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
			/>
			<p class="mt-1 text-sm text-gray-500">
				Number of teaching days per week (typically 5 for Mon-Fri)
			</p>
		</div>

		<div class="flex justify-end">
			<Button type="submit">Save Configuration</Button>
		</div>
	</form>
</div>
