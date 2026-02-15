<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import type { PageData, ActionData } from './$types';
	import Button from '$lib/components/ui/button/button.svelte';
	import AttachmentList from '$lib/components/attachments/attachment-list.svelte';
	import AttachmentForm from '$lib/components/attachments/attachment-form.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import Textarea from '$lib/components/ui/textarea/textarea.svelte';
	import Label from '$lib/components/ui/label/label.svelte';
	import * as Alert from '$lib/components/ui/alert/index.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let showModuleEditForm = $state(false);
	let showLessonForm = $state(false);
	let editingLessonId = $state<string | null>(null);
	let showSpecPointPicker = $state(false);
	let specPointPickerLessonId = $state<string | null>(null);
	let showAttachmentForm = $state(false);
	let attachmentError = $state('');
	let attachmentSuccess = $state('');

	// Drag and drop state
	let draggedLessonId = $state<string | null>(null);
	let dragOverIndex = $state<number | null>(null);
	let isReordering = $state(false);

	// Keyboard drag and drop state
	let keyboardDragActive = $state(false);
	let keyboardDragLessonIndex = $state<number | null>(null);

	// Module form state
	let moduleName = $state('');
	let moduleDescription = $state('');
	let moduleTargetSpecId = $state('');

	// Sync module form state with data when it changes
	$effect(() => {
		moduleName = data.module.name;
		moduleDescription = data.module.description || '';
		moduleTargetSpecId = data.module.targetSpecId || '';
	});

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

	async function handleDeleteAttachment(id: string) {
		const formData = new FormData();
		formData.append('id', id);

		const response = await fetch('?/deleteAttachment', {
			method: 'POST',
			body: formData
		});

		if (response.ok) {
			attachmentSuccess = 'Attachment deleted successfully';
			attachmentError = '';
			await invalidateAll();
		} else {
			attachmentError = 'Failed to delete attachment';
			attachmentSuccess = '';
		}

		setTimeout(() => {
			attachmentError = '';
			attachmentSuccess = '';
		}, 3000);
	}

	function handleAttachmentSuccess() {
		showAttachmentForm = false;
		attachmentSuccess = 'Attachment added successfully';
		attachmentError = '';
		invalidateAll();

		setTimeout(() => {
			attachmentSuccess = '';
		}, 3000);
	}

	function handleAttachmentError(message: string) {
		attachmentError = message;
		attachmentSuccess = '';

		setTimeout(() => {
			attachmentError = '';
		}, 3000);
	}

	// Drag and drop handlers
	function handleDragStart(e: DragEvent, lessonId: string) {
		if (!e.dataTransfer) return;
		draggedLessonId = lessonId;
		e.dataTransfer.effectAllowed = 'move';
		e.dataTransfer.setData('text/plain', lessonId);

		// Add dragging class to the element
		const target = e.currentTarget as HTMLElement;
		setTimeout(() => {
			target.classList.add('dragging');
		}, 0);
	}

	function handleDragEnd(e: DragEvent) {
		draggedLessonId = null;
		dragOverIndex = null;
		const target = e.currentTarget as HTMLElement;
		target.classList.remove('dragging');
	}

	function handleDragOver(e: DragEvent, index: number) {
		e.preventDefault();
		if (!e.dataTransfer) return;
		e.dataTransfer.dropEffect = 'move';
		dragOverIndex = index;
	}

	function handleDragLeave() {
		dragOverIndex = null;
	}

	function handleDrop(e: DragEvent, dropIndex: number) {
		e.preventDefault();
		dragOverIndex = null;

		if (!draggedLessonId) return;

		const draggedIndex = data.lessons.findIndex((l) => l.id === draggedLessonId);
		if (draggedIndex === -1 || draggedIndex === dropIndex) return;

		// Create new order
		const reorderedLessons = [...data.lessons];
		const [draggedLesson] = reorderedLessons.splice(draggedIndex, 1);
		reorderedLessons.splice(dropIndex, 0, draggedLesson);

		// Submit reorder
		submitReorder(reorderedLessons.map((l) => l.id));
	}

	async function submitReorder(lessonIds: string[]) {
		isReordering = true;

		const formData = new FormData();
		formData.append('lessonIds', JSON.stringify(lessonIds));

		try {
			const response = await fetch('?/reorderLessons', {
				method: 'POST',
				body: formData
			});

			if (response.ok) {
				await invalidateAll();
			}
		} finally {
			isReordering = false;
		}
	}

	// Keyboard handlers for accessibility
	function handleKeyDown(e: KeyboardEvent, index: number) {
		// Ignore if form is open or already reordering
		if (showLessonForm || isReordering) return;

		// Space or Enter to pick up/drop
		if (e.key === ' ' || e.key === 'Enter') {
			e.preventDefault();

			if (!keyboardDragActive) {
				// Pick up
				keyboardDragActive = true;
				keyboardDragLessonIndex = index;
				announceToScreenReader(
					`Picked up lesson ${index + 1}. Use arrow keys to move, Space or Enter to drop, Escape to cancel.`
				);
			} else if (keyboardDragLessonIndex !== null) {
				// Drop
				moveLessonKeyboard(keyboardDragLessonIndex, index);
				keyboardDragActive = false;
				keyboardDragLessonIndex = null;
			}
			return;
		}

		// Only handle arrow keys if actively dragging
		if (!keyboardDragActive || keyboardDragLessonIndex === null) return;

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			if (keyboardDragLessonIndex < data.lessons.length - 1) {
				keyboardDragLessonIndex++;
				announceToScreenReader(`Moving to position ${keyboardDragLessonIndex + 1}`);
			}
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			if (keyboardDragLessonIndex > 0) {
				keyboardDragLessonIndex--;
				announceToScreenReader(`Moving to position ${keyboardDragLessonIndex + 1}`);
			}
		} else if (e.key === 'Escape') {
			e.preventDefault();
			keyboardDragActive = false;
			keyboardDragLessonIndex = null;
			announceToScreenReader('Reordering cancelled');
		}
	}

	function moveLessonKeyboard(fromIndex: number, toIndex: number) {
		if (fromIndex === toIndex) {
			announceToScreenReader('No change in position');
			return;
		}

		const reorderedLessons = [...data.lessons];
		const [movedLesson] = reorderedLessons.splice(fromIndex, 1);
		reorderedLessons.splice(toIndex, 0, movedLesson);

		submitReorder(reorderedLessons.map((l) => l.id));
		announceToScreenReader(`Lesson moved to position ${toIndex + 1}`);
	}

	function announceToScreenReader(message: string) {
		// Create or update aria-live region for screen reader announcements
		let liveRegion = document.getElementById('drag-drop-announcer');
		if (!liveRegion) {
			liveRegion = document.createElement('div');
			liveRegion.id = 'drag-drop-announcer';
			liveRegion.setAttribute('aria-live', 'polite');
			liveRegion.setAttribute('aria-atomic', 'true');
			liveRegion.className = 'sr-only';
			document.body.appendChild(liveRegion);
		}
		liveRegion.textContent = message;
	}
</script>

<div class="container mx-auto p-4 sm:p-6">
	<div class="mb-4 sm:mb-6">
		<a
			href={resolve('/modules')}
			data-sveltekit-preload-data
			class="inline-block min-h-[44px] py-2 text-sm text-blue-600 hover:underline"
			>&larr; Back to Module Library</a
		>
	</div>

	{#if form?.success}
		<Alert.Root class="mb-4">
			<Alert.Description>Changes saved successfully!</Alert.Description>
		</Alert.Root>
	{/if}

	{#if form?.error}
		<Alert.Root variant="destructive" class="mb-4">
			<Alert.Description>{form.error}</Alert.Description>
		</Alert.Root>
	{/if}

	<!-- Module Details Section -->
	<div class="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:mb-8 sm:p-6">
		<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<h1 class="text-2xl font-bold sm:text-3xl">{data.module.name}</h1>
			<Button
				onclick={() => (showModuleEditForm = !showModuleEditForm)}
				class="min-h-[44px] w-full sm:w-auto"
			>
				{showModuleEditForm ? 'Cancel Edit' : 'Edit Module'}
			</Button>
		</div>

		{#if showModuleEditForm}
			<form method="POST" action="?/updateModule" use:enhance class="space-y-4">
				<div>
					<Label for="name">
						Module Name <span class="text-red-500">*</span>
					</Label>
					<Input type="text" id="name" name="name" bind:value={moduleName} required class="mt-2" />
				</div>

				<div>
					<Label for="description">Description</Label>
					<Textarea
						id="description"
						name="description"
						bind:value={moduleDescription}
						rows={3}
						class="mt-2"
					/>
				</div>

				<div>
					<Label for="targetSpecId">Target Specification</Label>
					<select
						id="targetSpecId"
						name="targetSpecId"
						bind:value={moduleTargetSpecId}
						class="mt-2 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
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

	<!-- Attachments Section -->
	<div class="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:mb-8 sm:p-6">
		<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<h2 class="text-xl font-semibold sm:text-2xl">Module Attachments</h2>
			<Button
				onclick={() => (showAttachmentForm = !showAttachmentForm)}
				class="min-h-[44px] w-full sm:w-auto"
			>
				{showAttachmentForm ? 'Cancel' : 'Add Attachment'}
			</Button>
		</div>

		{#if attachmentError}
			<Alert.Root variant="destructive" class="mb-4">
				<Alert.Description>{attachmentError}</Alert.Description>
			</Alert.Root>
		{/if}

		{#if attachmentSuccess}
			<Alert.Root class="mb-4">
				<Alert.Description>{attachmentSuccess}</Alert.Description>
			</Alert.Root>
		{/if}

		{#if showAttachmentForm}
			<div class="mb-4">
				<AttachmentForm
					entityType="module"
					entityId={data.module.id}
					onSuccess={handleAttachmentSuccess}
					onError={handleAttachmentError}
				/>
			</div>
		{/if}

		<AttachmentList attachments={data.moduleAttachments} onDelete={handleDeleteAttachment} />
	</div>

	<!-- Lessons Section -->
	<div class="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:mb-8 sm:p-6">
		<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<h2 class="text-xl font-semibold sm:text-2xl">Lessons</h2>
			<Button
				onclick={() => {
					showLessonForm = true;
					editingLessonId = null;
				}}
				class="min-h-[44px] w-full sm:w-auto"
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
					<Label for="title">
						Lesson Title <span class="text-red-500">*</span>
					</Label>
					<Input
						type="text"
						id="title"
						name="title"
						bind:value={lessonTitle}
						required
						class="mt-2"
					/>
				</div>

				<div>
					<Label for="content">Content (Markdown)</Label>
					<Textarea
						id="content"
						name="content"
						bind:value={lessonContent}
						rows={6}
						placeholder="Use markdown for formatting..."
						class="mt-2 font-mono text-sm"
					/>
				</div>

				<div>
					<Label for="duration">Duration (periods)</Label>
					<Input
						type="number"
						id="duration"
						name="duration"
						bind:value={lessonDuration}
						min="1"
						max="10"
						class="mt-2 w-32"
					/>
				</div>

				<div class="flex justify-end gap-2">
					<Button type="button" variant="outline" onclick={resetLessonForm}>Cancel</Button>
					<Button type="submit">{editingLessonId ? 'Update Lesson' : 'Add Lesson'}</Button>
				</div>
			</form>
		{/if}

		{#if data.lessons.length === 0}
			<p class="text-center text-muted-foreground">
				No lessons yet. Click "Add Lesson" to create your first lesson.
			</p>
		{:else}
			<div class="space-y-3">
				{#each data.lessons as lesson, index (lesson.id)}
					{#if dragOverIndex === index && draggedLessonId !== lesson.id}
						<div class="drop-indicator"></div>
					{/if}
					<div
						class="draggable rounded-lg border border-gray-200 bg-gray-50 p-3 sm:p-4"
						class:keyboard-dragging={keyboardDragActive && keyboardDragLessonIndex === index}
						draggable={!showLessonForm && !isReordering}
						ondragstart={(e) => handleDragStart(e, lesson.id)}
						ondragend={handleDragEnd}
						ondragover={(e) => handleDragOver(e, index)}
						ondragleave={handleDragLeave}
						ondrop={(e) => handleDrop(e, index)}
						onkeydown={(e) => handleKeyDown(e, index)}
						tabindex={showLessonForm || isReordering ? -1 : 0}
						role="button"
						aria-label={`Lesson ${lesson.order}: ${lesson.title}. ${!showLessonForm && !isReordering ? 'Press Space or Enter to reorder.' : ''}`}
						aria-grabbed={keyboardDragActive && keyboardDragLessonIndex === index}
					>
						<div class="mb-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
							<div class="flex-1">
								<h3 class="text-base font-semibold sm:text-lg">
									{lesson.order}. {lesson.title}
								</h3>
								<p class="text-sm text-gray-600">
									{lesson.duration}
									{lesson.duration === 1 ? 'period' : 'periods'}
								</p>
							</div>
							<div class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
								<Button
									size="sm"
									variant="outline"
									onclick={() => openEditLesson(lesson)}
									class="min-h-[44px]"
								>
									Edit
								</Button>
								<form method="POST" action="?/deleteLesson" use:enhance class="contents">
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
										class="min-h-[44px]"
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
					{#if dragOverIndex === data.lessons.length && index === data.lessons.length - 1}
						<div class="drop-indicator"></div>
					{/if}
				{/each}
			</div>
		{/if}
	</div>

	<!-- Spec Point Picker Modal -->
	{#if showSpecPointPicker && specPointPickerLessonId}
		<div class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black p-4">
			<div
				class="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-lg bg-white p-4 shadow-xl sm:p-6"
			>
				<h3 class="mb-4 text-lg font-semibold sm:text-xl">Link Specification Point</h3>
				<div class="space-y-2">
					{#each data.specPoints as specPoint (specPoint.id)}
						<form method="POST" action="?/linkSpecPoint" use:enhance>
							<input type="hidden" name="lessonId" value={specPointPickerLessonId} />
							<input type="hidden" name="specPointId" value={specPoint.id} />
							<button
								type="submit"
								class="block min-h-[44px] w-full rounded-lg border border-gray-200 p-3 text-left hover:bg-gray-50 active:bg-gray-100"
							>
								<span class="text-sm font-medium text-blue-600 sm:text-base"
									>{specPoint.reference}</span
								>
								<p class="text-xs text-gray-600 sm:text-sm">{specPoint.content}</p>
							</button>
						</form>
					{/each}
				</div>
				<div class="mt-4 flex justify-end">
					<Button variant="outline" onclick={closeSpecPointPicker} class="min-h-[44px]"
						>Close</Button
					>
				</div>
			</div>
		</div>
	{/if}
</div>
