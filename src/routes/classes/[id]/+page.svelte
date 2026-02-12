<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageData, ActionData } from './$types';
	import Button from '$lib/components/ui/button/button.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Edit mode states
	let editingClass = $state(false);
	let addingSlot = $state(false);
	let editingSlot = $state<string | null>(null);
	let editingLesson = $state<string | null>(null);

	// Form states for class editing
	let name = $state(data.class.name);
	let yearGroup = $state(data.class.yearGroup);
	let academicYear = $state(data.class.academicYear);
	let studentCount = $state(data.class.studentCount?.toString() || '');
	let room = $state(data.class.room || '');
	let notes = $state(data.class.notes || '');

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
		<div class="mb-4 rounded-md bg-green-50 p-4 text-green-800">Changes saved successfully!</div>
	{/if}

	<!-- Error message -->
	{#if form?.error}
		<div class="mb-4 rounded-md bg-red-50 p-4 text-red-800">
			{form.error}
		</div>
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
						<label for="name" class="mb-2 block text-sm font-medium text-gray-700">
							Class Name <span class="text-red-500">*</span>
						</label>
						<input
							type="text"
							id="name"
							name="name"
							bind:value={name}
							required
							class="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
						/>
					</div>

					<div>
						<label for="yearGroup" class="mb-2 block text-sm font-medium text-gray-700">
							Year Group <span class="text-red-500">*</span>
						</label>
						<select
							id="yearGroup"
							name="yearGroup"
							bind:value={yearGroup}
							required
							class="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
						>
							{#each [7, 8, 9, 10, 11, 12, 13] as year (year)}
								<option value={year}>Year {year}</option>
							{/each}
						</select>
					</div>

					<div>
						<label for="academicYear" class="mb-2 block text-sm font-medium text-gray-700">
							Academic Year <span class="text-red-500">*</span>
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
					</div>

					<div>
						<label for="studentCount" class="mb-2 block text-sm font-medium text-gray-700">
							Student Count
						</label>
						<input
							type="number"
							id="studentCount"
							name="studentCount"
							bind:value={studentCount}
							placeholder="Optional"
							min="1"
							class="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
						/>
					</div>

					<div>
						<label for="room" class="mb-2 block text-sm font-medium text-gray-700"> Room </label>
						<input
							type="text"
							id="room"
							name="room"
							bind:value={room}
							placeholder="e.g., Lab 3"
							class="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
						/>
					</div>
				</div>

				<div>
					<label for="notes" class="mb-2 block text-sm font-medium text-gray-700"> Notes </label>
					<textarea
						id="notes"
						name="notes"
						bind:value={notes}
						rows="3"
						placeholder="Optional notes about the class"
						class="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
					></textarea>
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
						<label for="day" class="mb-2 block text-sm font-medium text-gray-700">
							Day <span class="text-red-500">*</span>
						</label>
						<select
							id="day"
							name="day"
							bind:value={slotDay}
							required
							class="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
						>
							{#each dayNames as dayName, i (i)}
								<option value={i + 1}>{dayName}</option>
							{/each}
						</select>
					</div>

					<div>
						<label for="periodStart" class="mb-2 block text-sm font-medium text-gray-700">
							Period Start <span class="text-red-500">*</span>
						</label>
						<input
							type="number"
							id="periodStart"
							name="periodStart"
							bind:value={slotPeriodStart}
							min="1"
							max="10"
							required
							class="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
						/>
					</div>

					<div>
						<label for="periodEnd" class="mb-2 block text-sm font-medium text-gray-700">
							Period End <span class="text-red-500">*</span>
						</label>
						<input
							type="number"
							id="periodEnd"
							name="periodEnd"
							bind:value={slotPeriodEnd}
							min="1"
							max="10"
							required
							class="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
						/>
					</div>

					<div>
						<label for="week" class="mb-2 block text-sm font-medium text-gray-700"> Week </label>
						<select
							id="week"
							name="week"
							bind:value={slotWeek}
							class="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
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
				<p class="text-gray-600">
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
									<label
										for="editDay-{slot.id}"
										class="mb-1 block text-xs font-medium text-gray-700"
									>
										Day
									</label>
									<select
										id="editDay-{slot.id}"
										name="day"
										bind:value={slotDay}
										required
										class="block w-full rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
									>
										{#each dayNames as dayName, i (i)}
											<option value={i + 1}>{dayName}</option>
										{/each}
									</select>
								</div>

								<div>
									<label
										for="editPeriodStart-{slot.id}"
										class="mb-1 block text-xs font-medium text-gray-700"
									>
										Start
									</label>
									<input
										type="number"
										id="editPeriodStart-{slot.id}"
										name="periodStart"
										bind:value={slotPeriodStart}
										min="1"
										max="10"
										required
										class="block w-full rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
									/>
								</div>

								<div>
									<label
										for="editPeriodEnd-{slot.id}"
										class="mb-1 block text-xs font-medium text-gray-700"
									>
										End
									</label>
									<input
										type="number"
										id="editPeriodEnd-{slot.id}"
										name="periodEnd"
										bind:value={slotPeriodEnd}
										min="1"
										max="10"
										required
										class="block w-full rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
									/>
								</div>

								<div>
									<label
										for="editWeek-{slot.id}"
										class="mb-1 block text-xs font-medium text-gray-700"
									>
										Week
									</label>
									<select
										id="editWeek-{slot.id}"
										name="week"
										bind:value={slotWeek}
										class="block w-full rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
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
			<div class="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-green-800">
				{form.message}
			</div>
		{/if}

		{#if data.scheduledLessons.length === 0}
			<div class="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
				<p class="text-gray-600">
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
									<label
										for="title-{lesson.id}"
										class="mb-1 block text-sm font-medium text-gray-700"
									>
										Lesson Title <span class="text-red-500">*</span>
									</label>
									<input
										type="text"
										id="title-{lesson.id}"
										name="title"
										bind:value={lessonTitle}
										required
										class="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
									/>
								</div>

								<div>
									<label
										for="content-{lesson.id}"
										class="mb-1 block text-sm font-medium text-gray-700"
									>
										Content (Markdown)
									</label>
									<textarea
										id="content-{lesson.id}"
										name="content"
										bind:value={lessonContent}
										rows="4"
										placeholder="Use markdown for formatting..."
										class="block w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
									></textarea>
								</div>

								<div>
									<label
										for="duration-{lesson.id}"
										class="mb-1 block text-sm font-medium text-gray-700"
									>
										Duration (periods)
									</label>
									<input
										type="number"
										id="duration-{lesson.id}"
										name="duration"
										bind:value={lessonDuration}
										min="1"
										max="10"
										class="block w-24 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
									/>
								</div>

								<div>
									<div class="mb-2 flex items-center justify-between">
										<span class="text-sm font-medium text-gray-700">Specification Points</span>
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
