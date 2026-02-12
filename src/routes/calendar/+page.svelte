<script lang="ts">
	/* eslint-disable svelte/prefer-svelte-reactivity */
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';
	import Button from '$lib/components/ui/button/button.svelte';

	let { data }: { data: PageData } = $props();

	let currentView = $derived(data.view as 'day' | 'week' | 'term');
	let currentDate = $derived(new Date(data.currentDate));

	const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

	function formatDate(date: Date | string): string {
		const d = typeof date === 'string' ? new Date(date) : date;
		return d.toLocaleDateString('en-GB', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}

	function formatShortDate(date: Date | string): string {
		const d = typeof date === 'string' ? new Date(date) : date;
		return d.toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short'
		});
	}

	function getWeekNumber(date: Date): number {
		const year = date.getUTCFullYear();
		const startDate = new Date(year, 8, 1);
		const diff = date.getTime() - startDate.getTime();
		return Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
	}

	function getCurrentWeekLabel(): string {
		if (data.timetableConfig?.weeks === 2) {
			const weekNum = getWeekNumber(currentDate);
			return weekNum % 2 === 1 ? 'Week A' : 'Week B';
		}
		return '';
	}

	function getDaysInWeek(): Date[] {
		const days: Date[] = [];
		const start = new Date(currentDate);
		start.setUTCHours(0, 0, 0, 0);
		const dayOfWeek = start.getUTCDay();
		const diff = start.getUTCDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
		start.setUTCDate(diff);

		const numWeeks = data.timetableConfig?.weeks === 2 ? 2 : 1;
		const numDays = numWeeks * 7;

		for (let i = 0; i < numDays; i++) {
			const day = new Date(start);
			day.setUTCDate(start.getUTCDate() + i);
			days.push(day);
		}
		return days;
	}

	function isToday(date: Date): boolean {
		const today = new Date();
		today.setUTCHours(0, 0, 0, 0);
		return date.getTime() === today.getTime();
	}

	function getEventForDay(date: Date): (typeof data.events)[0] | null {
		const checkDate = new Date(date);
		checkDate.setUTCHours(0, 0, 0, 0);
		return (
			data.events.find((event) => {
				const start = new Date(event.startDate);
				start.setUTCHours(0, 0, 0, 0);
				const end = new Date(event.endDate);
				end.setUTCHours(0, 0, 0, 0);
				return checkDate >= start && checkDate <= end;
			}) || null
		);
	}

	function getLessonForSlot(
		date: Date,
		slot: (typeof data.slots)[0]
	): (typeof data.scheduledLessons)[0] | null {
		const lessonDate = new Date(date);
		lessonDate.setUTCHours(0, 0, 0, 0);

		return (
			data.scheduledLessons.find((lesson) => {
				if (lesson.timetableSlotId !== slot.id) return false;
				const ld = new Date(lesson.calendarDate);
				ld.setUTCHours(0, 0, 0, 0);
				return ld.getTime() === lessonDate.getTime();
			}) || null
		);
	}

	function findSlotForPeriod(date: Date, period: number): (typeof data.slots)[0] | null {
		const dayOfWeek = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
		return (
			data.slots.find((slot) => {
				if (slot.day !== dayOfWeek) return false;
				if (data.timetableConfig?.weeks === 2 && slot.week) {
					const weekNum = getWeekNumber(date);
					const slotWeek = weekNum % 2 === 1 ? 'A' : 'B';
					if (slot.week !== slotWeek) return false;
				}
				return slot.periodStart <= period && slot.periodEnd >= period;
			}) || null
		);
	}

	function getDayOfWeek(date: Date): number {
		return date.getUTCDay() === 0 ? 7 : date.getUTCDay();
	}

	function getTermWeeks(): (Date | null)[][] {
		const weeks: (Date | null)[][] = [];
		const startOfTerm = new Date(data.currentDate);
		const month = startOfTerm.getUTCMonth();

		let termStart: Date;
		let termEnd: Date;

		if (month >= 8 || month <= 0) {
			termStart = new Date(Date.UTC(startOfTerm.getUTCFullYear(), 8, 1));
			termEnd = new Date(Date.UTC(startOfTerm.getUTCFullYear(), 11, 31));
		} else if (month <= 3) {
			termStart = new Date(Date.UTC(startOfTerm.getUTCFullYear(), 0, 1));
			termEnd = new Date(Date.UTC(startOfTerm.getUTCFullYear(), 2, 31));
		} else {
			termStart = new Date(Date.UTC(startOfTerm.getUTCFullYear(), 3, 1));
			termEnd = new Date(Date.UTC(startOfTerm.getUTCFullYear(), 6, 31));
		}

		const firstDayOfMonth = new Date(termStart);
		const startDayOfWeek = firstDayOfMonth.getUTCDay();
		const daysToMonday = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
		const weekStart = new Date(firstDayOfMonth);
		weekStart.setUTCDate(weekStart.getUTCDate() - daysToMonday);

		const current = new Date(weekStart);
		let week: (Date | null)[] = [];

		for (let i = 0; i < 42; i++) {
			const dayDate = new Date(current);

			if (dayDate < termStart || dayDate > termEnd) {
				week.push(null);
			} else {
				week.push(dayDate);
			}

			if (week.length === 7) {
				weeks.push(week);
				week = [];
			}
			current.setUTCDate(current.getUTCDate() + 1);
		}

		return weeks.filter((w) => w.some((d) => d !== null));
	}

	function getTeachingDaysCount(): number {
		const weeks = getTermWeeks();
		let count = 0;

		for (const week of weeks) {
			for (const day of week) {
				if (!day) continue;
				const event = getEventForDay(day);
				if (!event || event.type === 'absence') {
					count++;
				}
			}
		}

		return count;
	}

	function navigateToDay(day: Date) {
		const url = new URL(window.location.href);
		url.searchParams.set('view', 'day');
		url.searchParams.set('date', day.toISOString().split('T')[0]);
		window.location.href = url.toString();
	}
</script>

<div class="container mx-auto p-4 md:p-6">
	<div
		class="mb-4 flex flex-col gap-3 sm:mb-6 sm:gap-4 md:flex-row md:items-center md:justify-between"
	>
		<div>
			<h1 class="text-2xl font-bold text-gray-900 sm:text-3xl">Calendar</h1>
			<p class="text-sm text-gray-600">Academic Year {data.academicYear}</p>
		</div>

		<div class="flex flex-wrap items-center gap-2">
			<form method="POST" action="?/setView" use:enhance class="inline">
				<input type="hidden" name="currentDate" value={data.currentDate} />
				<input type="hidden" name="view" value="day" />
				<Button
					type="submit"
					variant={currentView === 'day' ? 'default' : 'outline'}
					size="sm"
					class="min-h-[44px] min-w-[60px]"
				>
					Day
				</Button>
			</form>
			<form method="POST" action="?/setView" use:enhance class="inline">
				<input type="hidden" name="currentDate" value={data.currentDate} />
				<input type="hidden" name="view" value="week" />
				<Button
					type="submit"
					variant={currentView === 'week' ? 'default' : 'outline'}
					size="sm"
					class="min-h-[44px] min-w-[60px]"
				>
					Week
				</Button>
			</form>
			<form method="POST" action="?/setView" use:enhance class="inline">
				<input type="hidden" name="currentDate" value={data.currentDate} />
				<input type="hidden" name="view" value="term" />
				<Button
					type="submit"
					variant={currentView === 'term' ? 'default' : 'outline'}
					size="sm"
					class="min-h-[44px] min-w-[60px]"
				>
					Term
				</Button>
			</form>
		</div>
	</div>

	<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<form method="POST" action="?/navigate" use:enhance>
			<input type="hidden" name="view" value={currentView} />
			<input type="hidden" name="currentDate" value={data.currentDate} />
			<input type="hidden" name="academicYear" value={data.academicYear} />
			<input type="hidden" name="direction" value="prev" />
			<Button type="submit" variant="outline" size="sm" class="min-h-[44px] w-full sm:w-auto">
				← Previous
			</Button>
		</form>

		<div class="order-first text-center sm:order-none">
			{#if currentView === 'day'}
				<h2 class="text-base font-semibold sm:text-lg">{formatDate(currentDate)}</h2>
				{#if data.timetableConfig?.weeks === 2}
					<p class="text-sm text-gray-600">{getCurrentWeekLabel()}</p>
				{/if}
			{:else if currentView === 'week'}
				{@const days = getDaysInWeek()}
				<h2 class="text-base font-semibold sm:text-lg">
					{formatShortDate(days[0])} - {formatShortDate(days[days.length - 1])}
				</h2>
				{#if data.timetableConfig?.weeks === 2}
					<p class="text-sm text-gray-600">Week A & Week B</p>
				{/if}
			{:else}
				<h2 class="text-base font-semibold sm:text-lg">Term Overview</h2>
			{/if}
		</div>

		<form method="POST" action="?/navigate" use:enhance>
			<input type="hidden" name="view" value={currentView} />
			<input type="hidden" name="currentDate" value={data.currentDate} />
			<input type="hidden" name="academicYear" value={data.academicYear} />
			<input type="hidden" name="direction" value="next" />
			<Button type="submit" variant="outline" size="sm" class="min-h-[44px] w-full sm:w-auto">
				Next →
			</Button>
		</form>
	</div>

	{#if !data.timetableConfig}
		<div class="rounded-lg border border-yellow-200 bg-yellow-50 p-8 text-center">
			<p class="text-yellow-800">
				No timetable configuration found for academic year {data.academicYear}. Please configure
				your timetable settings first.
			</p>
			<a href={resolve('/settings/timetable')} class="mt-4 inline-block">
				<Button>Configure Timetable</Button>
			</a>
		</div>
	{:else if data.classes.length === 0}
		<div class="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
			<p class="text-gray-600">No classes found for academic year {data.academicYear}.</p>
			<a href={resolve('/classes')} class="mt-4 inline-block">
				<Button>Create a Class</Button>
			</a>
		</div>
	{:else if currentView === 'day'}
		{@const dayOfWeek = getDayOfWeek(currentDate)}
		{@const holidayEvent = getEventForDay(currentDate)}

		<div class="rounded-lg border border-gray-200 bg-white shadow-sm">
			<div class="flex items-center justify-between border-b border-gray-200 px-4 py-3">
				<div class="flex items-center gap-3">
					<span class="text-lg font-medium">{dayNames[dayOfWeek - 1]}</span>
					<span class="text-sm text-gray-600">{formatShortDate(currentDate)}</span>
				</div>
				<div class="flex items-center gap-2">
					{#if data.timetableConfig?.weeks === 2}
						<span class="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
							{getCurrentWeekLabel()}
						</span>
					{/if}
					{#if holidayEvent}
						<span
							class="rounded-full px-2 py-1 text-xs font-medium {holidayEvent.type === 'holiday'
								? 'bg-gray-200 text-gray-700'
								: holidayEvent.type === 'closure'
									? 'bg-red-100 text-red-700'
									: 'bg-yellow-100 text-yellow-700'}"
						>
							{holidayEvent.title}
						</span>
					{/if}
				</div>
			</div>

			{#if holidayEvent}
				<div
					class="flex items-center justify-center p-8 {holidayEvent.type === 'holiday'
						? 'bg-gray-50'
						: holidayEvent.type === 'closure'
							? 'bg-red-50'
							: 'bg-yellow-50'}"
				>
					<div class="text-center">
						<p
							class="text-lg font-medium {holidayEvent.type === 'holiday'
								? 'text-gray-800'
								: holidayEvent.type === 'closure'
									? 'text-red-800'
									: 'text-yellow-800'}"
						>
							{holidayEvent.type === 'holiday'
								? '🏖️ Holiday - No Lessons'
								: holidayEvent.type === 'closure'
									? '🔒 School Closed'
									: '🤒 Staff Absence'}
						</p>
						<p class="mt-1 text-sm text-gray-600">{holidayEvent.title}</p>
					</div>
				</div>
			{:else}
				<div class="divide-y divide-gray-100">
					{#each Array(data.timetableConfig.periodsPerDay) as periodIndex (periodIndex)}
						{@const period = periodIndex + 1}
						{@const slot = findSlotForPeriod(currentDate, period)}
						{@const lesson = slot ? getLessonForSlot(currentDate, slot) : null}

						<div class="flex items-stretch">
							<div
								class="w-12 flex-shrink-0 border-r border-gray-100 bg-gray-50 p-2 text-center sm:w-16 sm:p-3"
							>
								<p class="text-xs font-medium text-gray-700 sm:text-sm">P{period}</p>
							</div>
							<div class="flex-1 p-2 sm:p-3">
								{#if lesson}
									<a
										href={resolve(`/classes/${lesson.classId}#lesson-${lesson.id}`)}
										class="block min-h-[44px] w-full rounded-md border p-3 text-left transition-colors hover:opacity-80 active:opacity-70 {data.classColors.get(
											lesson.classId
										) || 'border-gray-300 bg-gray-100'}"
									>
										<div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
											<div class="flex-1">
												<p class="text-sm font-medium sm:text-base">{lesson.title}</p>
												<p class="text-xs opacity-80 sm:text-sm">
													{lesson.className} (Year {lesson.classYearGroup})
												</p>
											</div>
											{#if lesson.duration > 1}
												<span
													class="self-start rounded-full bg-white/50 px-2 py-1 text-xs font-medium"
												>
													Double
												</span>
											{/if}
										</div>
									</a>
								{:else}
									<div
										class="flex h-14 items-center justify-center rounded-md border border-dashed border-gray-200 sm:h-16"
									>
										<p class="text-xs text-gray-400 sm:text-sm">No lesson scheduled</p>
									</div>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{:else if currentView === 'week'}
		{@const daysInWeek = getDaysInWeek()}

		<div class="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
			<table class="w-full min-w-[500px] sm:min-w-[600px]">
				<thead>
					{#if data.timetableConfig?.weeks === 2}
						<tr class="border-b border-gray-200">
							<th class="w-10 bg-gray-50 p-1 sm:w-16 sm:p-2"></th>
							<th
								colspan="7"
								class="border-r border-gray-200 bg-blue-50 p-1 text-center text-xs font-semibold text-blue-900 sm:p-2 sm:text-sm"
							>
								Week A
							</th>
							<th
								colspan="7"
								class="bg-purple-50 p-1 text-center text-xs font-semibold text-purple-900 sm:p-2 sm:text-sm"
							>
								Week B
							</th>
						</tr>
					{/if}
					<tr class="border-b border-gray-200">
						<th
							class="w-10 bg-gray-50 p-1 text-center text-xs font-medium text-gray-700 sm:w-16 sm:p-3 sm:text-sm"
						>
							P
						</th>
						{#each daysInWeek as day, index (day.toISOString())}
							{@const weekIndex = Math.floor(index / 7)}
							{@const isWeekA = weekIndex === 0}
							<th
								class="min-w-[60px] p-1 text-center text-xs font-medium sm:min-w-[80px] sm:p-3 sm:text-sm {isToday(
									day
								)
									? 'bg-blue-100 text-blue-900'
									: isWeekA && data.timetableConfig?.weeks === 2
										? 'bg-blue-50/30 text-gray-700'
										: !isWeekA && data.timetableConfig?.weeks === 2
											? 'bg-purple-50/30 text-gray-700'
											: 'text-gray-700'} {index === 6 ? 'border-r border-gray-300' : ''}"
							>
								<div class="hidden sm:block">
									{dayNames[day.getUTCDay() === 0 ? 6 : day.getUTCDay() - 1]}
								</div>
								<div class="sm:hidden">
									{dayNames[day.getUTCDay() === 0 ? 6 : day.getUTCDay() - 1].slice(0, 3)}
								</div>
								<div class="text-[10px] font-normal sm:text-xs">{formatShortDate(day)}</div>
							</th>
						{/each}
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100">
					{#each Array(data.timetableConfig.periodsPerDay) as periodIndex (periodIndex)}
						{@const period = periodIndex + 1}
						<tr>
							<td
								class="bg-gray-50 p-1 text-center text-xs font-medium text-gray-700 sm:p-2 sm:text-sm"
							>
								{period}
							</td>
							{#each daysInWeek as day, index (day.toISOString())}
								{@const holidayEvent = getEventForDay(day)}
								{@const slot = findSlotForPeriod(day, period)}
								{@const lesson = slot ? getLessonForSlot(day, slot) : null}

								<td class="p-0.5 sm:p-1 {index === 6 ? 'border-r border-gray-300' : ''}">
									{#if holidayEvent}
										<div
											class="flex h-12 items-center justify-center rounded border text-[10px] sm:h-16 sm:text-xs {holidayEvent.type ===
											'holiday'
												? 'border-gray-200 bg-gray-100 text-gray-600'
												: holidayEvent.type === 'closure'
													? 'border-red-200 bg-red-50 text-red-700'
													: 'border-yellow-200 bg-yellow-50 text-yellow-700'}"
										>
											<span class="hidden sm:inline">
												{holidayEvent.type === 'holiday'
													? 'Holiday'
													: holidayEvent.type === 'closure'
														? 'Closed'
														: 'Absent'}
											</span>
											<span class="sm:hidden">
												{holidayEvent.type === 'holiday'
													? 'Hol'
													: holidayEvent.type === 'closure'
														? 'Closed'
														: 'Abs'}
											</span>
										</div>
									{:else if lesson}
										<button
											class="h-full min-h-[48px] w-full rounded border p-1 text-left text-[10px] transition-colors hover:opacity-80 active:opacity-70 sm:min-h-[64px] sm:p-2 sm:text-xs {data.classColors.get(
												lesson.classId
											) || 'border-gray-300 bg-gray-100'}"
										>
											<p class="line-clamp-2 leading-tight font-medium">{lesson.title}</p>
											<p class="mt-0.5 line-clamp-1 opacity-75">{lesson.className}</p>
										</button>
									{:else}
										<div
											class="flex h-12 items-center justify-center rounded border border-dashed border-gray-200 sm:h-16"
										></div>
									{/if}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		{@const termWeeks = getTermWeeks()}

		<div class="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
			<div class="min-w-[600px]">
				<!-- Calendar Grid -->
				<div class="grid grid-cols-7 gap-px bg-gray-200">
					<!-- Day headers -->
					{#each dayNames as dayName (dayName)}
						<div class="bg-gray-50 p-2 text-center text-xs font-medium text-gray-700 sm:text-sm">
							<span class="hidden sm:inline">{dayName}</span>
							<span class="sm:hidden">{dayName.slice(0, 3)}</span>
						</div>
					{/each}

					<!-- Calendar days -->
					{#each termWeeks as week, weekIndex (weekIndex)}
						{#each week as day (day ? day.toISOString() : `empty-${weekIndex}`)}
							{@const event = day ? getEventForDay(day) : null}
							{@const dayLessons = day
								? data.scheduledLessons.filter((lesson) => {
										const ld = new Date(lesson.calendarDate);
										ld.setUTCHours(0, 0, 0, 0);
										return day && ld.getTime() === day.getTime();
									})
								: []}
							{@const lessonCount = dayLessons.length}

							<div
								class="min-h-[80px] bg-white p-2 sm:min-h-[100px] {day && isToday(day)
									? 'ring-2 ring-blue-500 ring-inset'
									: ''} {event
									? event.type === 'holiday'
										? 'bg-gray-50'
										: event.type === 'closure'
											? 'bg-red-50'
											: 'bg-yellow-50'
									: ''}"
							>
								{#if day}
									<!-- Date number -->
									<div class="mb-1 flex items-center justify-between">
										<button
											class="rounded px-1.5 py-0.5 text-xs font-medium transition-colors hover:bg-gray-100 sm:text-sm {isToday(
												day
											)
												? 'bg-blue-500 text-white hover:bg-blue-600'
												: 'text-gray-700'}"
											onclick={() => navigateToDay(day)}
										>
											{day.getUTCDate()}
										</button>
										{#if data.timetableConfig?.weeks === 2}
											{@const weekNum = getWeekNumber(day)}
											<span class="text-[10px] text-gray-500">
												{weekNum % 2 === 1 ? 'A' : 'B'}
											</span>
										{/if}
									</div>

									<!-- Event indicator -->
									{#if event}
										<div
											class="mb-1 truncate rounded px-1.5 py-0.5 text-[10px] font-medium {event.type ===
											'holiday'
												? 'bg-gray-200 text-gray-700'
												: event.type === 'closure'
													? 'bg-red-200 text-red-700'
													: 'bg-yellow-200 text-yellow-700'}"
											title={event.title}
										>
											{event.type === 'holiday' ? '🏖️' : event.type === 'closure' ? '🔒' : '🤒'}
											<span class="hidden sm:inline">{event.title}</span>
										</div>
									{:else if lessonCount > 0}
										<!-- Lesson count -->
										<div class="space-y-0.5">
											{#each dayLessons.slice(0, 2) as lesson (lesson.id)}
												<button
													class="w-full truncate rounded border px-1.5 py-0.5 text-left text-[10px] transition-colors hover:opacity-80 {data.classColors.get(
														lesson.classId
													) || 'border-gray-300 bg-gray-100'}"
													onclick={() => navigateToDay(day)}
													title={lesson.title}
												>
													{lesson.title}
												</button>
											{/each}
											{#if lessonCount > 2}
												<button
													class="w-full rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 hover:bg-gray-200"
													onclick={() => navigateToDay(day)}
												>
													+{lessonCount - 2} more
												</button>
											{/if}
										</div>
									{/if}
								{/if}
							</div>
						{/each}
					{/each}
				</div>
			</div>
		</div>

		<!-- Term Summary Stats -->
		<div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<div class="rounded-lg border border-gray-200 bg-white p-4">
				<p class="text-sm text-gray-600">Total Lessons</p>
				<p class="text-2xl font-bold text-gray-900">{data.scheduledLessons.length}</p>
			</div>
			<div class="rounded-lg border border-gray-200 bg-white p-4">
				<p class="text-sm text-gray-600">Holidays</p>
				<p class="text-2xl font-bold text-gray-900">
					{data.events.filter((e) => e.type === 'holiday').length}
				</p>
			</div>
			<div class="rounded-lg border border-gray-200 bg-white p-4">
				<p class="text-sm text-gray-600">School Closures</p>
				<p class="text-2xl font-bold text-gray-900">
					{data.events.filter((e) => e.type === 'closure').length}
				</p>
			</div>
			<div class="rounded-lg border border-gray-200 bg-white p-4">
				<p class="text-sm text-gray-600">Teaching Days</p>
				<p class="text-2xl font-bold text-gray-900">
					{getTeachingDaysCount()}
				</p>
			</div>
		</div>
	{/if}

	<div class="mt-6 flex flex-wrap gap-2">
		{#each data.classes as cls (cls.id)}
			<div
				class="flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1 text-sm {data.classColors.get(
					cls.id
				) || 'bg-gray-100'}"
			>
				<span class="font-medium">{cls.name}</span>
				<span class="opacity-75">Year {cls.yearGroup}</span>
			</div>
		{/each}
	</div>
</div>
