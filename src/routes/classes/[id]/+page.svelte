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
	import { getKeyStageColor, getKeyStageLabel } from '$lib/utils/key-stage-colors';
	import { Clock, Calendar } from 'lucide-svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Edit mode states
	let editingClass = $state(false);
	let showSuccess = $state(false);
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
			showSuccess = true;
			const timer = setTimeout(() => (showSuccess = false), 3000);
			resetClassForm();
			resetSlotForm();
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
</script>

<div class="container mx-auto p-4 sm:p-6">
	<div class="mb-4 sm:mb-6">
		<a
			href={resolve('/classes')}
			class="inline-block min-h-[44px] py-2 text-accent-secondary transition-colors hover:text-accent-secondary-hover"
		>
			&larr; Back to Classes
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

	<!-- Class Details Section -->
	<div class="mb-6 rounded-lg border border-border bg-surface p-4 shadow-sm sm:mb-8 sm:p-6">
		<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div class="flex items-center gap-3">
				<div
					class="h-10 w-1.5 rounded-full"
					style="background-color: {getKeyStageColor(data.class.yearGroup)}"
					aria-hidden="true"
				></div>
				<div class="flex items-center gap-2">
					<h1 class="text-2xl font-bold sm:text-3xl">{data.class.name}</h1>
					{#if getKeyStageLabel(data.class.yearGroup)}
						<span
							class="hidden rounded-full px-2.5 py-1 text-xs font-medium sm:inline-block"
							style="background-color: {getKeyStageColor(
								data.class.yearGroup
							)}20; color: {getKeyStageColor(data.class.yearGroup)}"
						>
							{getKeyStageLabel(data.class.yearGroup)}
						</span>
					{/if}
				</div>
			</div>
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
							class="mt-2 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none md:text-sm"
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
					<span class="font-medium">Course:</span>
					{#if data.class.course?.id}
						<a
							href={resolve('/courses/[id]', { id: data.class.course.id })}
							class="text-accent-secondary hover:underline"
						>
							{data.class.course.name}
						</a>
					{:else}
						None
					{/if}
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
	<div class="mb-6 rounded-lg border border-border bg-surface p-4 shadow-sm sm:mb-8 sm:p-6">
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
	<div class="mb-6 rounded-lg border border-border bg-surface p-4 shadow-sm sm:mb-8 sm:p-6">
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
							class="mt-2 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none md:text-sm"
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
							class="mt-2 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none md:text-sm"
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
			<div
				class="flex flex-col items-center justify-center rounded-lg border border-border bg-background-subtle p-12 text-center"
			>
				<Clock class="mb-4 h-12 w-12 text-muted-foreground" />
				<h3 class="font-display mb-2 text-xl font-semibold">No timetable slots</h3>
				<p class="mb-4 max-w-sm text-sm text-muted-foreground">
					Add timetable slots to define when this class meets each week.
				</p>
				<Button onclick={() => (addingSlot = true)}>Add First Slot</Button>
			</div>
		{:else}
			<div class="space-y-2">
				{#each data.timetableSlots as slot (slot.id)}
					{#if editingSlot === slot.id}
						<form
							method="POST"
							action="?/updateSlot"
							use:enhance
							class="rounded-md border border-border-strong bg-background-subtle p-4"
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
										class="mt-1 flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
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
										class="mt-1 flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
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
							class="flex items-center justify-between rounded-md border border-border bg-surface p-4"
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
	<div class="mb-6 rounded-lg border border-border bg-surface p-4 shadow-sm sm:mb-8 sm:p-6">
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
			<div
				class="flex flex-col items-center justify-center rounded-lg border border-border bg-background-subtle p-12 text-center"
			>
				<Calendar class="mb-4 h-12 w-12 text-muted-foreground" />
				<h3 class="font-display mb-2 text-xl font-semibold">No lessons scheduled</h3>
				<p class="mb-4 max-w-sm text-sm text-muted-foreground">
					Assign a module to this class to automatically schedule lessons into your timetable slots.
				</p>
				<a href={resolve(`/classes/${data.class.id}/assign`)} class="inline-block">
					<Button>Assign Module</Button>
				</a>
			</div>
		{:else}
			<div class="space-y-2">
				{#each data.scheduledLessons as lesson (lesson.id)}
					{#if editingLesson === lesson.id}
						<form
							method="POST"
							action="?/updateScheduledLesson"
							use:enhance
							id="lesson-{lesson.id}"
							class="rounded-md border border-border-strong bg-background-subtle p-4"
						>
							<input type="hidden" name="lessonId" value={lesson.id} />

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
									<Label for="content-{lesson.id}">Content</Label>
									<Textarea
										id="content-{lesson.id}"
										name="content"
										bind:value={lessonContent}
										rows={4}
										placeholder="Lesson notes..."
										class="mt-2 text-sm"
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

								<div class="flex justify-end gap-2">
									<Button type="button" variant="outline" size="sm" onclick={resetLessonForm}>
										Cancel
									</Button>
									<Button type="submit" size="sm">Save Changes</Button>
								</div>
							</div>
						</form>
					{:else}
						<div
							id="lesson-{lesson.id}"
							class="rounded-md border border-border bg-surface p-3 sm:p-4"
						>
							<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
								<div class="flex-1">
									<h3 class="text-base font-semibold sm:text-lg">{lesson.title}</h3>
									<p class="text-sm text-muted-foreground">{formatDate(lesson.calendarDate)}</p>
									{#if lesson.duration > 1}
										<p class="text-xs text-muted-foreground">{lesson.duration} periods</p>
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
											&larr; Back
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
											Forward &rarr;
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
