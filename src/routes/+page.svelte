<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';
	import * as Card from '$lib/components/ui/card';
	import { Calendar, Users, BookOpen, Palmtree, CalendarDays, Settings } from 'lucide-svelte';

	let { data }: { data: PageData } = $props();

	function formatDate(date: Date | null): string {
		if (!date) return 'N/A';
		return new Date(date).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}
</script>

<div class="container mx-auto p-4 sm:p-6">
	<!-- Welcome Header -->
	<div class="mb-6 sm:mb-8">
		<h1 class="mb-2 text-3xl font-bold sm:text-4xl">Welcome to Planck</h1>
		<p class="text-lg text-muted-foreground">Academic Year {data.academicYear}</p>
	</div>

	<!-- Stats Cards -->
	<div class="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<!-- Total Classes -->
		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">Total Classes</Card.Title>
				<Users class="h-4 w-4 text-muted-foreground" />
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold">{data.stats.totalClasses}</div>
				<p class="mt-1 text-xs text-muted-foreground">
					<a href={resolve('/classes')} class="hover:underline">View all classes</a>
				</p>
			</Card.Content>
		</Card.Root>

		<!-- Upcoming Lessons This Week -->
		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">This Week</Card.Title>
				<CalendarDays class="h-4 w-4 text-muted-foreground" />
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold">{data.stats.upcomingLessonsThisWeek}</div>
				<p class="mt-1 text-xs text-muted-foreground">
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					<a href={`${resolve('/calendar')}?view=week`} class="hover:underline">View calendar</a>
				</p>
			</Card.Content>
		</Card.Root>

		<!-- Total Modules -->
		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">Total Modules</Card.Title>
				<BookOpen class="h-4 w-4 text-muted-foreground" />
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold">{data.stats.totalModules}</div>
				<p class="mt-1 text-xs text-muted-foreground">
					<a href={resolve('/modules')} class="hover:underline">Browse modules</a>
				</p>
			</Card.Content>
		</Card.Root>

		<!-- Next Holiday -->
		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">Next Holiday</Card.Title>
				<Palmtree class="h-4 w-4 text-muted-foreground" />
			</Card.Header>
			<Card.Content>
				{#if data.stats.nextHoliday}
					<div class="text-lg font-bold">{data.stats.nextHoliday.title}</div>
					<p class="mt-1 text-xs text-muted-foreground">
						{formatDate(data.stats.nextHoliday.startDate)} - {formatDate(
							data.stats.nextHoliday.endDate
						)}
					</p>
				{:else}
					<div class="text-lg font-bold">None scheduled</div>
					<p class="mt-1 text-xs text-muted-foreground">
						<a href={resolve('/settings/term-dates')} class="hover:underline">Add term dates</a>
					</p>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Today's Lessons -->
	<div class="mb-8">
		<h2 class="mb-4 text-2xl font-bold">Today's Lessons</h2>
		{#if data.todaysLessons.length === 0}
			<Card.Root>
				<Card.Content class="pt-6">
					<p class="text-center text-muted-foreground">No lessons scheduled for today</p>
				</Card.Content>
			</Card.Root>
		{:else}
			<div class="space-y-3">
				{#each data.todaysLessons as lesson (lesson.id)}
					<Card.Root>
						<Card.Content class="flex items-center justify-between pt-6">
							<div>
								<h3 class="font-semibold">{lesson.title}</h3>
								<p class="text-sm text-muted-foreground">
									{lesson.className} (Year {lesson.classYearGroup}) • {lesson.duration} period{lesson.duration >
									1
										? 's'
										: ''}
								</p>
							</div>
						</Card.Content>
					</Card.Root>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Quick Actions -->
	<div>
		<h2 class="mb-4 text-2xl font-bold">Quick Actions</h2>
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<a href={resolve('/calendar')} data-sveltekit-preload-data>
				<Card.Root class="cursor-pointer transition-shadow hover:shadow-md dark:hover:bg-accent/50">
					<Card.Content class="flex flex-col items-center justify-center p-6 text-center">
						<Calendar class="mb-2 h-8 w-8" />
						<h3 class="font-semibold">View Calendar</h3>
						<p class="mt-1 text-xs text-muted-foreground">See your schedule</p>
					</Card.Content>
				</Card.Root>
			</a>

			<a href={resolve('/classes')} data-sveltekit-preload-data>
				<Card.Root class="cursor-pointer transition-shadow hover:shadow-md dark:hover:bg-accent/50">
					<Card.Content class="flex flex-col items-center justify-center p-6 text-center">
						<Users class="mb-2 h-8 w-8" />
						<h3 class="font-semibold">Manage Classes</h3>
						<p class="mt-1 text-xs text-muted-foreground">View and edit classes</p>
					</Card.Content>
				</Card.Root>
			</a>

			<a href={resolve('/modules')} data-sveltekit-preload-data>
				<Card.Root class="cursor-pointer transition-shadow hover:shadow-md dark:hover:bg-accent/50">
					<Card.Content class="flex flex-col items-center justify-center p-6 text-center">
						<BookOpen class="mb-2 h-8 w-8" />
						<h3 class="font-semibold">Browse Modules</h3>
						<p class="mt-1 text-xs text-muted-foreground">Explore lesson plans</p>
					</Card.Content>
				</Card.Root>
			</a>

			<a href={resolve('/settings')} data-sveltekit-preload-data>
				<Card.Root class="cursor-pointer transition-shadow hover:shadow-md dark:hover:bg-accent/50">
					<Card.Content class="flex flex-col items-center justify-center p-6 text-center">
						<Settings class="mb-2 h-8 w-8" />
						<h3 class="font-semibold">Configure Settings</h3>
						<p class="mt-1 text-xs text-muted-foreground">Manage your setup</p>
					</Card.Content>
				</Card.Root>
			</a>
		</div>
	</div>
</div>
