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

	// Edit mode states
	let editingClass = $state(false);
	let addingSlot = $state(false);
	let editingSlot = $state<string | null>(null);
	let editingLesson = $state<string | null>(null);
	let showAttachmentForm = $state(false);
	let attachmentError = $state('');
	let attachmentSuccess = $state('');

	// Form states for class editing
	let name = $state('');
	let yearGroup = $state(7);
	let academicYear = $state('');
	let studentCount = $state('');
	let room = $state('');
	let notes = $state('');

	// Sync form state with data when it changes (e.g., after navigation or form submission)
	$effect(() => {
		name = data.class.name;
		yearGroup = data.class.yearGroup;
		academicYear = data.class.academicYear;
		studentCount = data.class.studentCount?.toString() || '';
		room = data.class.room || '';
		notes = data.class.notes || '';
	});

	// Form states for slot management
	let slotDay = $state(1);
	let slotPeriodStart = $state(1);
	let slotPeriodEnd = $state(1);
	let slotWeek = $state('');

	// Form states for lesson editing
	let lessonTitle = $state('');
	let lessonContent = $state('');
	let lessonDuration = $state(1);
	let lessonSpecPointIds = $state<string[]>([]);
	let showSpecPointPicker = $state(false);

	// Day names for display
	const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

	function resetClassForm() {
		editingClass = false;
		name = data.class.name;
		yearGroup = data.class.yearGroup;
		academicYear = data.class.academicYear;
		studentCount = data.class.studentCount?.toString() || '';
		room = data.class.room || '';
		notes = data.class.notes || '';
	}

	function resetSlotForm() {
		addingSlot = false;
		editingSlot = null;
		slotDay = 1;
		slotPeriodStart = 1;
		slotPeriodEnd = 1;
		slotWeek = '';
	}

	function resetLessonForm() {
		editingLesson = null;
		lessonTitle = '';
		lessonContent = '';
		lessonDuration = 1;
		lessonSpecPointIds = [];
		showSpecPointPicker = false;
	}

	type ScheduledLesson = {
		id: string;
		title: string;
		content: string | null;
		duration: number;
		calendarDate: Date;
	};

	function startEditLesson(lesson: ScheduledLesson) {
		editingLesson = lesson.id;
		lessonTitle = lesson.title;
		lessonContent = lesson.content || '';
		lessonDuration = lesson.duration;

		// Load spec point IDs for this lesson
		const links = data.specPointLinks.filter((link) => link.scheduledLessonId === lesson.id);
		lessonSpecPointIds = links.map((link) => link.specPointId);
		showSpecPointPicker = false;
	}

	function toggleSpecPoint(specPointId: string) {
		if (lessonSpecPointIds.includes(specPointId)) {
			lessonSpecPointIds = lessonSpecPointIds.filter((id) => id !== specPointId);
		} else {
			lessonSpecPointIds = [...lessonSpecPointIds, specPointId];
		}
	}

	type TimetableSlot = {
		id: string;
		day: number;
		periodStart: number;
		periodEnd: number;
		week: 'A' | 'B' | null;
	};

	function startEditSlot(slot: TimetableSlot) {
		editingSlot = slot.id;
		slotDay = slot.day;
		slotPeriodStart = slot.periodStart;
		slotPeriodEnd = slot.periodEnd;
		slotWeek = slot.week || '';
	}

	function formatSlotDisplay(slot: TimetableSlot) {
		const day = dayNames[slot.day - 1];
		const periods =
			slot.periodStart === slot.periodEnd
				? `Period ${slot.periodStart}`
				: `Periods ${slot.periodStart}-${slot.periodEnd}`;
		const week = slot.week ? ` (Week ${slot.week})` : '';
		return `${day}, ${periods}${week}`;
	}

	function formatDate(date: Date | string) {
		const d = typeof date === 'string' ? new Date(date) : date;
		return d.toLocaleDateString('en-GB', {
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	$effect(() => {
		if (form?.success) {
			resetClassForm();
			resetSlotForm();
			resetLessonForm();
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
</script>

<div class="container mx-auto p-4 sm:p-6">
	<!-- Back to classes list -->
	<div class="mb-4 sm:mb-6">
		<a
			href={resolve('/classes')}
			class="inline-block min-h-[44px] py-2 text-indigo-600 transition-colors hover:text-indigo-800"
		>
			← Back to Classes
		</a>
	</div>

	<!-- Success message -->
	{#if form?.success}
		<Alert.Root class="mb-4">
			<Alert.Description>Changes saved successfully!</Alert.Description>
		</Alert.Root>
	{/if}

	<!-- Error message -->
	{#if form?.error}
		<Alert.Root variant="destructive" class="mb-4">
			<Alert.Description>{form.error}</Alert.Description>
		</Alert.Root>
	{/if}

	<!-- Class Details Section -->
	<div class="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:mb-8 sm:p-6">
		<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<h1 class="text-2xl font-bold sm:text-3xl">{data.class.name}</h1>
			<Button onclick={() => (editingClass = !editingClass)} class="min-h-[44px] w-full sm:w-auto">
				{editingClass ? 'Cancel' : 'Edit Details'}
			</Button>
		</div>

		{#if editingClass}
			<form method="POST" action="?/updateClass" use:enhance class="space-y-4">
				<div class="grid gap-4 md:grid-cols-2">
					<div>
						<Label for="name">
							Class Name <span class="text-red-500">*</span>
						</Label>
						<Input type="text" id="name" name="name" bind:value={name} required class="mt-2" />
					</div>

					<div>
						<Label for="yearGroup">
							Year Group <span class="text-red-500">*</span>
						</Label>
						<select
							id="yearGroup"
							name="yearGroup"
							bind:value={yearGroup}
							required
							class="mt-2 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
						>
							{#each [7, 8, 9, 10, 11, 12, 13] as year (year)}
								<option value={year}>Year {year}</option>
							{/each}
						</select>
					</div>

					<div>
						<Label for="academicYear">
							Academic Year <span class="text-red-500">*</span>
						</Label>
						<Input
							type="text"
							id="academicYear"
							name="academicYear"
							bind:value={academicYear}
							placeholder="e.g., 2024-25"
							required
							class="mt-2"
						/>
					</div>

					<div>
						<Label for="studentCount">Student Count</Label>
						<Input
							type="number"
							id="studentCount"
							name="studentCount"
							bind:value={studentCount}
							placeholder="Optional"
							min="1"
							class="mt-2"
						/>
					</div>

					<div>
						<Label for="room">Room</Label>
						<Input
							type="text"
							id="room"
							name="room"
							bind:value={room}
							placeholder="e.g., Lab 3"
							class="mt-2"
						/>
					</div>
				</div>

				<div>
					<Label for="notes">Notes</Label>
					<Textarea
						id="notes"
						name="notes"
						bind:value={notes}
						rows={3}
						placeholder="Optional notes about the class"
						class="mt-2"
					/>
				</div>

				<div class="flex justify-end gap-2">
					<Button type="button" variant="outline" onclick={resetClassForm}>Cancel</Button>
					<Button type="submit">Save Changes</Button>
				</div>
			</form>
		{:else}
			<div class="space-y-2 text-sm">
				<p>
					<span class="font-medium">Year Group:</span>
					{data.class.yearGroup}
				</p>
				<p>
					<span class="font-medium">Exam Specification:</span>
					{data.class.examSpec?.name || 'N/A'}
				</p>
				<p>
					<span class="font-medium">Academic Year:</span>
					{data.class.academicYear}
				</p>
				{#if data.class.studentCount}
					<p>
						<span class="font-medium">Students:</span>
						{data.class.studentCount}
					</p>
				{/if}
				{#if data.class.room}
					<p>
						<span class="font-medium">Room:</span>
						{data.class.room}
					</p>
				{/if}
				{#if data.class.notes}
					<p>
						<span class="font-medium">Notes:</span>
						{data.class.notes}
					</p>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Attachments Section -->
	<div class="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:mb-8 sm:p-6">
		<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<h2 class="text-xl font-semibold sm:text-2xl">Attachments</h2>
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
					entityType="class"
					entityId={data.class.id}
					onSuccess={handleAttachmentSuccess}
					onError={handleAttachmentError}
				/>
			</div>
		{/if}

		<AttachmentList attachments={data.attachments} onDelete={handleDeleteAttachment} />
	</div>

	<!-- Timetable Slots Section -->
	<div class="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:mb-8 sm:p-6">
		<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<h2 class="text-xl font-semibold sm:text-2xl">Timetable Slots</h2>
			<Button onclick={() => (addingSlot = !addingSlot)} class="min-h-[44px] w-full sm:w-auto">
				{addingSlot ? 'Cancel' : 'Add Slot'}
			</Button>
		</div>

		{#if addingSlot}
			<form method="POST" action="?/addSlot" use:enhance class="mb-6 space-y-4">
				<div class="grid gap-4 md:grid-cols-4">
					<div>
						<Label for="day">
							Day <span class="text-red-500">*</span>
						</Label>
						<select
							id="day"
							name="day"
							bind:value={slotDay}
							required
							class="mt-2 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
						>
							{#each dayNames as dayName, i (i)}
								<option value={i + 1}>{dayName}</option>
							{/each}
						</select>
					</div>

					<div>
						<Label for="periodStart">
							Period Start <span class="text-red-500">*</span>
						</Label>
						<Input
							type="number"
							id="periodStart"
							name="periodStart"
							bind:value={slotPeriodStart}
							min="1"
							max="10"
							required
							class="mt-2"
						/>
					</div>

					<div>
						<Label for="periodEnd">
							Period End <span class="text-red-500">*</span>
						</Label>
						<Input
							type="number"
							id="periodEnd"
							name="periodEnd"
							bind:value={slotPeriodEnd}
							min="1"
							max="10"
							required
							class="mt-2"
						/>
					</div>

					<div>
						<Label for="week">Week</Label>
						<select
							id="week"
							name="week"
							bind:value={slotWeek}
							class="mt-2 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
						>
							<option value="">None (1-week timetable)</option>
							<option value="A">Week A</option>
							<option value="B">Week B</option>
						</select>
					</div>
				</div>

				<div class="flex justify-end gap-2">
					<Button type="button" variant="outline" onclick={resetSlotForm}>Cancel</Button>
					<Button type="submit">Add Slot</Button>
				</div>
			</form>
		{/if}

		{#if data.timetableSlots.length === 0}
			<div class="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
				<p class="text-muted-foreground">
					No timetable slots configured. Click "Add Slot" to add the first slot.
				</p>
			</div>
		{:else}
			<div class="space-y-2">
				{#each data.timetableSlots as slot (slot.id)}
					{#if editingSlot === slot.id}
						<form
							method="POST"
							action="?/updateSlot"
							use:enhance
							class="rounded-md border border-gray-300 bg-gray-50 p-4"
						>
							<input type="hidden" name="slotId" value={slot.id} />
							<div class="grid gap-4 md:grid-cols-5">
								<div>
									<Label for="editDay-{slot.id}" class="text-xs">Day</Label>
									<select
										id="editDay-{slot.id}"
										name="day"
										bind:value={slotDay}
										required
										class="mt-1 flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
									>
										{#each dayNames as dayName, i (i)}
											<option value={i + 1}>{dayName}</option>
										{/each}
									</select>
								</div>

								<div>
									<Label for="editPeriodStart-{slot.id}" class="text-xs">Start</Label>
									<Input
										type="number"
										id="editPeriodStart-{slot.id}"
										name="periodStart"
										bind:value={slotPeriodStart}
										min="1"
										max="10"
										required
										class="mt-1 h-8 text-sm"
									/>
								</div>

								<div>
									<Label for="editPeriodEnd-{slot.id}" class="text-xs">End</Label>
									<Input
										type="number"
										id="editPeriodEnd-{slot.id}"
										name="periodEnd"
										bind:value={slotPeriodEnd}
										min="1"
										max="10"
										required
										class="mt-1 h-8 text-sm"
									/>
								</div>

								<div>
									<Label for="editWeek-{slot.id}" class="text-xs">Week</Label>
									<select
										id="editWeek-{slot.id}"
										name="week"
										bind:value={slotWeek}
										class="mt-1 flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
									>
										<option value="">None</option>
										<option value="A">Week A</option>
										<option value="B">Week B</option>
									</select>
								</div>

								<div class="flex items-end gap-2">
									<Button type="submit" size="sm">Save</Button>
									<Button type="button" variant="outline" size="sm" onclick={resetSlotForm}
										>Cancel</Button
									>
								</div>
							</div>
						</form>
					{:else}
						<div
							class="flex items-center justify-between rounded-md border border-gray-200 bg-white p-4"
						>
							<span class="text-sm">{formatSlotDisplay(slot)}</span>
							<div class="flex gap-2">
								<Button variant="outline" size="sm" onclick={() => startEditSlot(slot)}>Edit</Button
								>
								<form method="POST" action="?/deleteSlot" use:enhance class="inline">
									<input type="hidden" name="slotId" value={slot.id} />
									<Button
										type="submit"
										variant="destructive"
										size="sm"
										onclick={(e) => {
											if (!confirm('Are you sure you want to delete this slot?')) {
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
		{/if}
	</div>

	<!-- Scheduled Lessons Section -->
	<div class="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:mb-8 sm:p-6">
		<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<h2 class="text-xl font-semibold sm:text-2xl">Scheduled Lessons</h2>
			<a href={resolve(`/classes/${data.class.id}/assign`)} class="w-full sm:w-auto">
				<Button class="min-h-[44px] w-full">Assign Module</Button>
			</a>
		</div>

		{#if form?.message}
			<Alert.Root class="mb-4">
				<Alert.Description>{form.message}</Alert.Description>
			</Alert.Root>
		{/if}

		{#if data.scheduledLessons.length === 0}
			<div class="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
				<p class="text-muted-foreground">
					No lessons scheduled yet. Assign a module to this class to create scheduled lessons.
				</p>
			</div>
		{:else}
			<div class="space-y-2">
				{#each data.scheduledLessons as lesson (lesson.id)}
					{#if editingLesson === lesson.id}
						<!-- Edit Form -->
						<form
							method="POST"
							action="?/updateScheduledLesson"
							use:enhance
							id="lesson-{lesson.id}"
							class="rounded-md border border-gray-300 bg-gray-50 p-4"
						>
							<input type="hidden" name="lessonId" value={lesson.id} />
							<input type="hidden" name="specPointIds" value={lessonSpecPointIds.join(',')} />

							<div class="space-y-3">
								<div>
									<Label for="title-{lesson.id}">
										Lesson Title <span class="text-red-500">*</span>
									</Label>
									<Input
										type="text"
										id="title-{lesson.id}"
										name="title"
										bind:value={lessonTitle}
										required
										class="mt-2 text-sm"
									/>
								</div>

								<div>
									<Label for="content-{lesson.id}">Content (Markdown)</Label>
									<Textarea
										id="content-{lesson.id}"
										name="content"
										bind:value={lessonContent}
										rows={4}
										placeholder="Use markdown for formatting..."
										class="mt-2 font-mono text-sm"
									/>
								</div>

								<div>
									<Label for="duration-{lesson.id}">Duration (periods)</Label>
									<Input
										type="number"
										id="duration-{lesson.id}"
										name="duration"
										bind:value={lessonDuration}
										min="1"
										max="10"
										class="mt-2 w-24 text-sm"
									/>
								</div>

								<div>
									<div class="mb-2 flex items-center justify-between">
										<Label class="text-sm">Specification Points</Label>
										{#if data.availableSpecPoints.length > 0}
											<Button
												type="button"
												size="sm"
												variant="outline"
												onclick={() => (showSpecPointPicker = !showSpecPointPicker)}
											>
												{showSpecPointPicker ? 'Hide' : 'Manage'} Spec Points
											</Button>
										{/if}
									</div>

									{#if lessonSpecPointIds.length > 0}
										<div class="mb-2 space-y-1">
											{#each lessonSpecPointIds as specPointId (specPointId)}
												{@const specPoint = data.availableSpecPoints.find(
													(sp) => sp.id === specPointId
												)}
												{#if specPoint}
													<div
														class="flex items-center justify-between rounded bg-white px-2 py-1 text-xs"
													>
														<span class="font-mono">{specPoint.reference}</span>
														<button
															type="button"
															onclick={() => toggleSpecPoint(specPointId)}
															class="text-red-600 hover:text-red-800"
														>
															Remove
														</button>
													</div>
												{/if}
											{/each}
										</div>
									{/if}

									{#if showSpecPointPicker && data.availableSpecPoints.length > 0}
										<div
											class="max-h-48 space-y-1 overflow-y-auto rounded border border-gray-200 bg-white p-2"
										>
											{#each data.availableSpecPoints as specPoint (specPoint.id)}
												<label
													class="flex cursor-pointer items-start gap-2 rounded p-2 hover:bg-gray-50"
												>
													<input
														type="checkbox"
														checked={lessonSpecPointIds.includes(specPoint.id)}
														onchange={() => toggleSpecPoint(specPoint.id)}
														class="mt-0.5"
													/>
													<div class="flex-1">
														<p class="font-mono text-xs font-medium">{specPoint.reference}</p>
														<p class="text-xs text-gray-600">{specPoint.content}</p>
													</div>
												</label>
											{/each}
										</div>
									{/if}
								</div>

								<div class="flex justify-end gap-2">
									<Button type="button" variant="outline" size="sm" onclick={resetLessonForm}>
										Cancel
									</Button>
									<Button type="submit" size="sm">Save Changes</Button>
								</div>
							</div>
						</form>
					{:else}
						<!-- Display Mode -->
						<div
							id="lesson-{lesson.id}"
							class="rounded-md border border-gray-200 bg-white p-3 sm:p-4"
						>
							<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
								<div class="flex-1">
									<h3 class="text-base font-semibold sm:text-lg">{lesson.title}</h3>
									<p class="text-sm text-gray-600">{formatDate(lesson.calendarDate)}</p>
									{#if lesson.duration > 1}
										<p class="text-xs text-gray-500">{lesson.duration} periods</p>
									{/if}
									{#if data.specPointLinks.filter((link) => link.scheduledLessonId === lesson.id).length > 0}
										{@const lessonSpecPoints = data.specPointLinks
											.filter((link) => link.scheduledLessonId === lesson.id)
											.map((link) =>
												data.availableSpecPoints.find((sp) => sp.id === link.specPointId)
											)
											.filter((sp) => sp)}
										<div class="mt-1 flex flex-wrap gap-1">
											{#each lessonSpecPoints as sp (sp?.id)}
												{#if sp}
													<span
														class="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-xs text-blue-800"
													>
														{sp.reference}
													</span>
												{/if}
											{/each}
										</div>
									{/if}
								</div>
								<div class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
									<Button
										variant="outline"
										size="sm"
										onclick={() => startEditLesson(lesson)}
										title="Edit lesson"
										class="min-h-[44px]"
									>
										Edit
									</Button>
									<form method="POST" action="?/pushLessonBack" use:enhance class="contents">
										<input type="hidden" name="lessonId" value={lesson.id} />
										<Button
											type="submit"
											variant="outline"
											size="sm"
											title="Push lesson back to previous slot"
											class="min-h-[44px]"
										>
											← Back
										</Button>
									</form>
									<form method="POST" action="?/pushLessonForward" use:enhance class="contents">
										<input type="hidden" name="lessonId" value={lesson.id} />
										<Button
											type="submit"
											variant="outline"
											size="sm"
											title="Push lesson forward to next slot"
											class="min-h-[44px]"
										>
											Forward →
										</Button>
									</form>
								</div>
							</div>
						</div>
					{/if}
				{/each}
			</div>
		{/if}
	</div>
</div>
