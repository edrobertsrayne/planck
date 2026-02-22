<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { PageData, ActionData } from './$types';
	import Button from '$lib/components/ui/button/button.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import Label from '$lib/components/ui/label/label.svelte';
	import * as Alert from '$lib/components/ui/alert';
	import BlockEditorRenderer from '$lib/components/block-editor-renderer.svelte';
	import { BookOpen } from 'lucide-svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let showCreateForm = $state(false);
	let showSuccess = $state(false);
	let name = $state('');

	function resetForm() {
		showCreateForm = false;
		name = '';
	}

	$effect(() => {
		if (form?.success) {
			showSuccess = true;
			const timer = setTimeout(() => (showSuccess = false), 3000);
			invalidateAll();
			resetForm();
			return () => clearTimeout(timer);
		}
	});
</script>

<div class="container mx-auto p-4 sm:p-6">
	<div class="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
		<h1 class="text-2xl font-bold sm:text-3xl">Courses</h1>
		<Button
			onclick={() => (showCreateForm = !showCreateForm)}
			class="min-h-[44px] w-full sm:w-auto"
		>
			{showCreateForm ? 'Cancel' : 'Create New Course'}
		</Button>
	</div>

	{#if showSuccess}
		<Alert.Root class="mb-4">
			<Alert.Title>Success</Alert.Title>
			<Alert.Description>Course created successfully!</Alert.Description>
		</Alert.Root>
	{/if}

	{#if form?.error}
		<Alert.Root variant="destructive" class="mb-4">
			<Alert.Title>Error</Alert.Title>
			<Alert.Description>{form.error}</Alert.Description>
		</Alert.Root>
	{/if}

	{#if showCreateForm}
		<div class="mb-8 rounded-lg border border-border bg-surface p-6 shadow-sm">
			<h2 class="mb-4 text-xl font-semibold">Create New Course</h2>
			<form method="POST" action="?/create" use:enhance class="space-y-4">
				<div>
					<Label for="name">
						Course Name <span class="text-red-500">*</span>
					</Label>
					<Input
						type="text"
						id="name"
						name="name"
						bind:value={name}
						placeholder="e.g., GCSE Physics, Year 9 Physics"
						required
						class="mt-2"
					/>
				</div>

				<div class="flex justify-end gap-2">
					<Button type="button" variant="outline" onclick={resetForm}>Cancel</Button>
					<Button type="submit">Create Course</Button>
				</div>
			</form>
		</div>
	{/if}

	{#if data.courses.length === 0}
		<div
			class="flex flex-col items-center justify-center rounded-lg border border-border bg-background-subtle p-12 text-center"
		>
			<BookOpen class="mb-4 h-12 w-12 text-muted-foreground" />
			<h3 class="font-display mb-2 text-xl font-semibold">No courses yet</h3>
			<p class="mb-4 max-w-sm text-sm text-muted-foreground">
				Get started by creating your first course. Courses contain modules, which contain lessons.
			</p>
			<Button onclick={() => (showCreateForm = true)}>Create Your First Course</Button>
		</div>
	{:else}
		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{#each data.courses as courseItem (courseItem.id)}
				<a
					href="/courses/{courseItem.id}"
					data-sveltekit-preload-data
					class="block rounded-lg border border-border bg-surface p-6 shadow-sm transition-shadow hover:shadow-md"
				>
					<h3 class="mb-2 text-xl font-semibold">{courseItem.name}</h3>
					{#if courseItem.notes}
						<div class="mb-3 line-clamp-3 text-sm text-muted-foreground">
							<BlockEditorRenderer data={courseItem.notes} />
						</div>
					{/if}
					<div class="flex gap-4 text-sm text-muted-foreground">
						<span>{courseItem.moduleCount} module{courseItem.moduleCount !== 1 ? 's' : ''}</span>
						<span>{courseItem.lessonCount} lesson{courseItem.lessonCount !== 1 ? 's' : ''}</span>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>
