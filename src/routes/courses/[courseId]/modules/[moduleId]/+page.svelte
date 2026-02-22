<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { PageData, ActionData } from './$types';
	import Button from '$lib/components/ui/button/button.svelte';
	import AttachmentList from '$lib/components/attachments/attachment-list.svelte';
	import AttachmentForm from '$lib/components/attachments/attachment-form.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import Label from '$lib/components/ui/label/label.svelte';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import BlockEditor from '$lib/components/block-editor.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let showModuleEditForm = $state(false);
	let showLessonForm = $state(false);
	let showSuccess = $state(false);
	let editingLessonId = $state<string | null>(null);
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
	let moduleNotes = $state<string | null>(null);

	$effect(() => {
		moduleName = data.module.name;
		moduleNotes = data.module.notes;
	});

	// Lesson form state
	let lessonTitle = $state('');
	let lessonContent = $state<string | null>(null);
	let lessonDuration = $state(1);

	function resetModuleForm() {
		showModuleEditForm = false;
		moduleName = data.module.name;
		moduleNotes = data.module.notes;
	}

	function resetLessonForm() {
		showLessonForm = false;
		editingLessonId = null;
		lessonTitle = '';
		lessonContent = null;
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
		lessonContent = lesson.content;
		lessonDuration = lesson.duration;
		showLessonForm = true;
	}

	$effect(() => {
		if (form?.success) {
			showSuccess = true;
			const timer = setTimeout(() => (showSuccess = false), 3000);
			resetModuleForm();
			resetLessonForm();
			return () => clearTimeout(timer);
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

	function handleModuleNotesSave(json: string) {
		const formData = new FormData();
		formData.append('name', data.module.name);
		formData.append('notes', json);
		fetch('?/updateModule', {
			method: 'POST',
			body: formData
		});
	}

	// Drag and drop handlers
	function handleDragStart(e: DragEvent, lessonId: string) {
		if (!e.dataTransfer) return;
		draggedLessonId = lessonId;
		e.dataTransfer.effectAllowed = 'move';
		e.dataTransfer.setData('text/plain', lessonId);

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

		const reorderedLessons = [...data.lessons];
		const [draggedLesson] = reorderedLessons.splice(draggedIndex, 1);
		reorderedLessons.splice(dropIndex, 0, draggedLesson);

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

	function handleKeyDown(e: KeyboardEvent, index: number) {
		if (showLessonForm || isReordering) return;

		if (e.key === ' ' || e.key === 'Enter') {
			e.preventDefault();

			if (!keyboardDragActive) {
				keyboardDragActive = true;
				keyboardDragLessonIndex = index;
				announceToScreenReader(
					`Picked up lesson ${index + 1}. Use arrow keys to move, Space or Enter to drop, Escape to cancel.`
				);
			} else if (keyboardDragLessonIndex !== null) {
				moveLessonKeyboard(keyboardDragLessonIndex, index);
				keyboardDragActive = false;
				keyboardDragLessonIndex = null;
			}
			return;
		}

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
	<!-- Breadcrumb -->
	<div class="mb-4 sm:mb-6">
		<nav class="text-sm text-muted-foreground">
			<a href="/courses" class="hover:underline">Courses</a>
			<span class="mx-1">/</span>
			<a href="/courses/{data.course.id}" class="hover:underline">{data.course.name}</a>
			<span class="mx-1">/</span>
			<span class="text-foreground">{data.module.name}</span>
		</nav>
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

	<!-- Module Details Section -->
	<div class="mb-6 rounded-lg border border-border bg-surface p-4 shadow-sm sm:mb-8 sm:p-6">
		<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<h1 class="text-2xl font-bold sm:text-3xl">{data.module.name}</h1>
			<div class="flex gap-2">
				<Button
					onclick={() => (showModuleEditForm = !showModuleEditForm)}
					class="min-h-[44px] w-full sm:w-auto"
				>
					{showModuleEditForm ? 'Cancel Edit' : 'Edit Module'}
				</Button>
				<form method="POST" action="?/deleteModule" use:enhance class="contents">
					<Button
						type="submit"
						variant="destructive"
						class="min-h-[44px] w-full sm:w-auto"
						onclick={(e) => {
							if (!confirm('Delete this module and all its lessons? This cannot be undone.')) {
								e.preventDefault();
							}
						}}
					>
						Delete
					</Button>
				</form>
			</div>
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
					<Label>Notes</Label>
					<div class="mt-2">
						<BlockEditor data={moduleNotes} name="notes" placeholder="Module notes..." />
					</div>
				</div>

				<div class="flex justify-end gap-2">
					<Button type="button" variant="outline" onclick={resetModuleForm}>Cancel</Button>
					<Button type="submit">Save Changes</Button>
				</div>
			</form>
		{:else}
			<div class="space-y-2 text-sm text-muted-foreground">
				<p>
					<span class="font-medium">Lessons:</span>
					{data.lessons.length}
				</p>
			</div>
			<div class="mt-4">
				<BlockEditor
					data={data.module.notes}
					name="notes"
					placeholder="Add module notes..."
					onSave={handleModuleNotesSave}
				/>
			</div>
		{/if}
	</div>

	<!-- Attachments Section -->
	<div class="mb-6 rounded-lg border border-border bg-surface p-4 shadow-sm sm:mb-8 sm:p-6">
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
	<div class="mb-6 rounded-lg border border-border bg-surface p-4 shadow-sm sm:mb-8 sm:p-6">
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
				class="mb-6 space-y-4 rounded-lg border border-border bg-background-subtle p-4"
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
					<Label>Content</Label>
					<div class="mt-2">
						<BlockEditor data={lessonContent} name="content" placeholder="Lesson content..." />
					</div>
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
						class="draggable rounded-lg border border-border bg-background-subtle p-3 sm:p-4"
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
								<p class="text-sm text-muted-foreground">
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
							<div class="rounded bg-surface p-3 text-sm">
								<BlockEditor data={lesson.content} placeholder="" />
							</div>
						{/if}
					</div>
					{#if dragOverIndex === data.lessons.length && index === data.lessons.length - 1}
						<div class="drop-indicator"></div>
					{/if}
				{/each}
			</div>
		{/if}
	</div>
</div>
