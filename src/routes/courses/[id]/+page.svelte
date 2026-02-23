<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import type { PageData, ActionData } from './$types';
	import Button from '$lib/components/ui/button/button.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import Label from '$lib/components/ui/label/label.svelte';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import BlockEditor from '$lib/components/block-editor.svelte';
	import { BookOpen } from 'lucide-svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let showEditForm = $state(false);
	let showModuleForm = $state(false);
	let showSuccess = $state(false);
	let courseName = $state('');
	let courseNotes = $state<string | null>(null);
	let moduleName = $state('');

	$effect(() => {
		courseName = data.course.name;
		courseNotes = data.course.notes;
	});

	function resetEditForm() {
		showEditForm = false;
		courseName = data.course.name;
		courseNotes = data.course.notes;
	}

	function resetModuleForm() {
		showModuleForm = false;
		moduleName = '';
	}

	$effect(() => {
		if (form?.success) {
			showSuccess = true;
			const timer = setTimeout(() => (showSuccess = false), 3000);
			invalidateAll();
			resetEditForm();
			resetModuleForm();
			return () => clearTimeout(timer);
		}
	});

	function handleNotesSave(json: string) {
		// Auto-save notes via fetch
		const formData = new FormData();
		formData.append('name', data.course.name);
		formData.append('notes', json);
		fetch('?/updateCourse', {
			method: 'POST',
			body: formData
		});
	}
</script>

<div class="container mx-auto p-4 sm:p-6">
	<div class="mb-4 sm:mb-6">
		<a
			href={resolve('/courses')}
			data-sveltekit-preload-data
			class="inline-block min-h-[44px] py-2 text-sm text-accent-secondary hover:underline"
		>
			&larr; Back to Courses
		</a>
	</div>

	{#if showSuccess}
		<Alert.Root class="mb-4">
			<Alert.Description>Changes saved successfully!</Alert.Description>
		</Alert.Root>
	{/if}

	{#if form?.error}
		<Alert.Root variant="destructive" class="mb-4">
			<Alert.Description>{form.error}</Alert.Description>
		</Alert.Root>
	{/if}

	<!-- Course Details -->
	<div class="mb-6 rounded-lg border border-border bg-surface p-4 shadow-sm sm:mb-8 sm:p-6">
		<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<h1 class="text-2xl font-bold sm:text-3xl">{data.course.name}</h1>
			<div class="flex gap-2">
				<Button
					onclick={() => (showEditForm = !showEditForm)}
					class="min-h-[44px] w-full sm:w-auto"
				>
					{showEditForm ? 'Cancel Edit' : 'Edit Course'}
				</Button>
				<form method="POST" action="?/deleteCourse" use:enhance class="contents">
					<Button
						type="submit"
						variant="destructive"
						class="min-h-[44px] w-full sm:w-auto"
						onclick={(e) => {
							if (!confirm('Delete this course and all its modules? This cannot be undone.')) {
								e.preventDefault();
							}
						}}
					>
						Delete
					</Button>
				</form>
			</div>
		</div>

		{#if showEditForm}
			<form method="POST" action="?/updateCourse" use:enhance class="space-y-4">
				<div>
					<Label for="name">
						Course Name <span class="text-red-500">*</span>
					</Label>
					<Input type="text" id="name" name="name" bind:value={courseName} required class="mt-2" />
				</div>

				<div>
					<Label>Notes</Label>
					<div class="mt-2">
						<BlockEditor data={courseNotes} name="notes" placeholder="Course notes..." />
					</div>
				</div>

				<div class="flex justify-end gap-2">
					<Button type="button" variant="outline" onclick={resetEditForm}>Cancel</Button>
					<Button type="submit">Save Changes</Button>
				</div>
			</form>
		{:else}
			<div class="space-y-2 text-sm text-muted-foreground">
				<p>
					<span class="font-medium">Modules:</span>
					{data.modules.length}
				</p>
			</div>
			{#if data.course.notes}
				<div class="mt-4">
					<BlockEditor
						data={data.course.notes}
						name="notes"
						placeholder="Course notes..."
						onSave={handleNotesSave}
					/>
				</div>
			{:else if !showEditForm}
				<div class="mt-4">
					<BlockEditor
						data={null}
						name="notes"
						placeholder="Add course notes..."
						onSave={handleNotesSave}
					/>
				</div>
			{/if}
		{/if}
	</div>

	<!-- Modules Section -->
	<div class="mb-6 rounded-lg border border-border bg-surface p-4 shadow-sm sm:mb-8 sm:p-6">
		<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<h2 class="text-xl font-semibold sm:text-2xl">Modules</h2>
			<Button
				onclick={() => (showModuleForm = !showModuleForm)}
				class="min-h-[44px] w-full sm:w-auto"
			>
				{showModuleForm ? 'Cancel' : 'Add Module'}
			</Button>
		</div>

		{#if showModuleForm}
			<form method="POST" action="?/createModule" use:enhance class="mb-6 space-y-4">
				<div>
					<Label for="moduleName">
						Module Name <span class="text-red-500">*</span>
					</Label>
					<Input
						type="text"
						id="moduleName"
						name="name"
						bind:value={moduleName}
						placeholder="e.g., Forces and Motion"
						required
						class="mt-2"
					/>
				</div>

				<div class="flex justify-end gap-2">
					<Button type="button" variant="outline" onclick={resetModuleForm}>Cancel</Button>
					<Button type="submit">Add Module</Button>
				</div>
			</form>
		{/if}

		{#if data.modules.length === 0}
			<div
				class="flex flex-col items-center justify-center rounded-lg border border-border bg-background-subtle p-12 text-center"
			>
				<BookOpen class="mb-4 h-12 w-12 text-muted-foreground" />
				<h3 class="font-display mb-2 text-xl font-semibold">No modules yet</h3>
				<p class="mb-4 max-w-sm text-sm text-muted-foreground">
					Add modules to organize your lessons within this course.
				</p>
				<Button onclick={() => (showModuleForm = true)}>Add First Module</Button>
			</div>
		{:else}
			<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{#each data.modules as moduleItem (moduleItem.id)}
					<a
						href={resolve('/courses/[courseId]/modules/[moduleId]', {
							courseId: data.course.id,
							moduleId: moduleItem.id
						})}
						data-sveltekit-preload-data
						class="block rounded-lg border border-border bg-background-subtle p-4 transition-shadow hover:shadow-md"
					>
						<h3 class="mb-1 text-lg font-semibold">{moduleItem.name}</h3>
						<p class="text-sm text-muted-foreground">
							{moduleItem.lessonCount} lesson{moduleItem.lessonCount !== 1 ? 's' : ''}
						</p>
					</a>
				{/each}
			</div>
		{/if}
	</div>
</div>
