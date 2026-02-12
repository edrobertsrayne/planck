<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	import Button from '$lib/components/ui/button/button.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let showModuleEditForm = $state(false);
	let showLessonForm = $state(false);
	let editingLessonId = $state<string | null>(null);
	let showSpecPointPicker = $state(false);
	let specPointPickerLessonId = $state<string | null>(null);

	// Module form state
	let moduleName = $state(data.module.name);
	let moduleDescription = $state(data.module.description || '');
	let moduleTargetSpecId = $state(data.module.targetSpecId || '');

	// Lesson form state
	let lessonTitle = $state('');
	let lessonContent = $state('');
	let lessonDuration = $state(1);

	function resetModuleForm() {
		showModuleEditForm = false;
		moduleName = data.module.name;
		moduleDescription = data.module.description || '';
		moduleTargetSpecId = data.module.targetSpecId || '';
	}

	function resetLessonForm() {
		showLessonForm = false;
		editingLessonId = null;
		lessonTitle = '';
		lessonContent = '';
		lessonDuration = 1;
	}

	function openEditLesson(lesson: {
		id: string;
		title: string;
		content: string | null;
		duration: number;
	}) {
		editingLessonId = lesson.id;
		lessonTitle = lesson.title;
		lessonContent = lesson.content || '';
		lessonDuration = lesson.duration;
		showLessonForm = true;
	}

	function openSpecPointPicker(lessonId: string) {
		specPointPickerLessonId = lessonId;
		showSpecPointPicker = true;
	}

	function closeSpecPointPicker() {
		specPointPickerLessonId = null;
		showSpecPointPicker = false;
	}

	$effect(() => {
		if (form?.success) {
			resetModuleForm();
			resetLessonForm();
			closeSpecPointPicker();
		}
	});
</script>

<div class="container mx-auto p-6">
	<div class="mb-6">
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a href="/modules" data-sveltekit-preload-data class="text-sm text-blue-600 hover:underline"
			>&larr; Back to Module Library</a
		>
	</div>

	{#if form?.success}
		<div class="mb-4 rounded-md bg-green-50 p-4 text-green-800">Changes saved successfully!</div>
	{/if}

	{#if form?.error}
		<div class="mb-4 rounded-md bg-red-50 p-4 text-red-800">
			{form.error}
		</div>
	{/if}

	<!-- Module Details Section -->
	<div class="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
		<div class="mb-4 flex items-center justify-between">
			<h1 class="text-3xl font-bold">{data.module.name}</h1>
			<Button onclick={() => (showModuleEditForm = !showModuleEditForm)}>
				{showModuleEditForm ? 'Cancel Edit' : 'Edit Module'}
			</Button>
		</div>

		{#if showModuleEditForm}
			<form method="POST" action="?/updateModule" use:enhance class="space-y-4">
				<div>
					<label for="name" class="mb-2 block text-sm font-medium text-gray-700">
						Module Name <span class="text-red-500">*</span>
					</label>
					<input
						type="text"
						id="name"
						name="name"
						bind:value={moduleName}
						required
						class="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
					/>
				</div>

				<div>
					<label for="description" class="mb-2 block text-sm font-medium text-gray-700">
						Description
					</label>
					<textarea
						id="description"
						name="description"
						bind:value={moduleDescription}
						rows="3"
						class="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
					></textarea>
				</div>

				<div>
					<label for="targetSpecId" class="mb-2 block text-sm font-medium text-gray-700">
						Target Specification
					</label>
					<select
						id="targetSpecId"
						name="targetSpecId"
						bind:value={moduleTargetSpecId}
						class="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
					>
						<option value="">None (generic module)</option>
						{#each data.examSpecs as spec (spec.id)}
							<option value={spec.id}>{spec.name}</option>
						{/each}
					</select>
				</div>

				<div class="flex justify-end gap-2">
					<Button type="button" variant="outline" onclick={resetModuleForm}>Cancel</Button>
					<Button type="submit">Save Changes</Button>
				</div>
			</form>
		{:else}
			<div class="space-y-2 text-sm text-gray-600">
				{#if data.module.description}
					<p class="text-base">{data.module.description}</p>
				{/if}
				<p>
					<span class="font-medium">Target Spec:</span>
					{data.module.targetSpec?.name || 'Generic'}
				</p>
				<p>
					<span class="font-medium">Lessons:</span>
					{data.lessons.length}
				</p>
			</div>
		{/if}
	</div>

	<!-- Lessons Section -->
	<div class="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-2xl font-semibold">Lessons</h2>
			<Button
				onclick={() => {
					showLessonForm = true;
					editingLessonId = null;
				}}
			>
				Add Lesson
			</Button>
		</div>

		{#if showLessonForm}
			<form
				method="POST"
				action={editingLessonId ? '?/updateLesson' : '?/addLesson'}
				use:enhance
				class="mb-6 space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4"
			>
				{#if editingLessonId}
					<input type="hidden" name="lessonId" value={editingLessonId} />
				{/if}

				<div>
					<label for="title" class="mb-2 block text-sm font-medium text-gray-700">
						Lesson Title <span class="text-red-500">*</span>
					</label>
					<input
						type="text"
						id="title"
						name="title"
						bind:value={lessonTitle}
						required
						class="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
					/>
				</div>

				<div>
					<label for="content" class="mb-2 block text-sm font-medium text-gray-700">
						Content (Markdown)
					</label>
					<textarea
						id="content"
						name="content"
						bind:value={lessonContent}
						rows="6"
						placeholder="Use markdown for formatting..."
						class="block w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
					></textarea>
				</div>

				<div>
					<label for="duration" class="mb-2 block text-sm font-medium text-gray-700">
						Duration (periods)
					</label>
					<input
						type="number"
						id="duration"
						name="duration"
						bind:value={lessonDuration}
						min="1"
						max="10"
						class="block w-32 rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
					/>
				</div>

				<div class="flex justify-end gap-2">
					<Button type="button" variant="outline" onclick={resetLessonForm}>Cancel</Button>
					<Button type="submit">{editingLessonId ? 'Update Lesson' : 'Add Lesson'}</Button>
				</div>
			</form>
		{/if}

		{#if data.lessons.length === 0}
			<p class="text-center text-gray-600">
				No lessons yet. Click "Add Lesson" to create your first lesson.
			</p>
		{:else}
			<div class="space-y-3">
				{#each data.lessons as lesson (lesson.id)}
					<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
						<div class="mb-2 flex items-start justify-between">
							<div class="flex-1">
								<h3 class="text-lg font-semibold">
									{lesson.order}. {lesson.title}
								</h3>
								<p class="text-sm text-gray-600">
									{lesson.duration}
									{lesson.duration === 1 ? 'period' : 'periods'}
								</p>
							</div>
							<div class="flex gap-2">
								<Button size="sm" variant="outline" onclick={() => openEditLesson(lesson)}>
									Edit
								</Button>
								<form method="POST" action="?/deleteLesson" use:enhance>
									<input type="hidden" name="lessonId" value={lesson.id} />
									<Button
										type="submit"
										size="sm"
										variant="destructive"
										onclick={(e) => {
											if (!confirm(`Delete "${lesson.title}"?`)) {
												e.preventDefault();
											}
										}}
									>
										Delete
									</Button>
								</form>
							</div>
						</div>

						{#if lesson.content}
							<div class="mb-3 rounded bg-white p-3 text-sm">
								<pre class="font-sans whitespace-pre-wrap">{lesson.content}</pre>
							</div>
						{/if}

						{#if lesson.specPoints && lesson.specPoints.length > 0}
							<div class="mb-2">
								<p class="mb-1 text-sm font-medium text-gray-700">Linked Spec Points:</p>
								<div class="flex flex-wrap gap-2">
									{#each lesson.specPoints as specPoint (specPoint.id)}
										<form method="POST" action="?/unlinkSpecPoint" use:enhance class="inline-block">
											<input type="hidden" name="lessonId" value={lesson.id} />
											<input type="hidden" name="specPointId" value={specPoint.id} />
											<button
												type="submit"
												class="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800 hover:bg-blue-200"
											>
												{specPoint.reference}
												<span class="text-blue-600">&times;</span>
											</button>
										</form>
									{/each}
								</div>
							</div>
						{/if}

						{#if data.specPoints.length > 0}
							<Button size="sm" variant="outline" onclick={() => openSpecPointPicker(lesson.id)}>
								Link Spec Point
							</Button>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Spec Point Picker Modal -->
	{#if showSpecPointPicker && specPointPickerLessonId}
		<div class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
			<div class="max-h-[80vh] w-full max-w-2xl overflow-auto rounded-lg bg-white p-6 shadow-xl">
				<h3 class="mb-4 text-xl font-semibold">Link Specification Point</h3>
				<div class="space-y-2">
					{#each data.specPoints as specPoint (specPoint.id)}
						<form method="POST" action="?/linkSpecPoint" use:enhance>
							<input type="hidden" name="lessonId" value={specPointPickerLessonId} />
							<input type="hidden" name="specPointId" value={specPoint.id} />
							<button
								type="submit"
								class="block w-full rounded-lg border border-gray-200 p-3 text-left hover:bg-gray-50"
							>
								<span class="font-medium text-blue-600">{specPoint.reference}</span>
								<p class="text-sm text-gray-600">{specPoint.content}</p>
							</button>
						</form>
					{/each}
				</div>
				<div class="mt-4 flex justify-end">
					<Button variant="outline" onclick={closeSpecPointPicker}>Close</Button>
				</div>
			</div>
		</div>
	{/if}
</div>
