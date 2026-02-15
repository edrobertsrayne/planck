<script lang="ts">
	import { Settings, Calendar, Clock } from 'lucide-svelte';
	import * as Card from '$lib/components/ui/card/index.js';

	const settingsLinks = [
		{
			title: 'Timetable Configuration',
			description: 'Configure your timetable structure, periods, and week cycle',
			href: '/settings/timetable',
			icon: Clock
		},
		{
			title: 'Term Dates',
			description: 'Import and manage academic year term dates and holidays',
			href: '/settings/term-dates',
			icon: Calendar
		}
	];
</script>

<div class="container mx-auto max-w-4xl p-4 sm:p-6">
	<div class="mb-6 flex items-center gap-3 sm:mb-8">
		<Settings class="h-8 w-8 text-primary" />
		<h1 class="font-display text-3xl font-semibold sm:text-4xl">Settings</h1>
	</div>

	<div class="grid gap-4 sm:grid-cols-2 sm:gap-6">
		{#each settingsLinks as link (link.href)}
			<a
				href={link.href}
				data-sveltekit-preload-data
				data-sveltekit-reload
				class="transition-transform hover:scale-[1.02]"
			>
				<Card.Root class="h-full">
					<Card.Header>
						<div class="mb-3 flex items-center gap-3">
							<div class="rounded-lg bg-primary/10 p-2">
								<svelte:component this={link.icon} class="h-5 w-5 text-primary" />
							</div>
						</div>
						<Card.Title class="text-xl">{link.title}</Card.Title>
						<Card.Description class="mt-2">{link.description}</Card.Description>
					</Card.Header>
				</Card.Root>
			</a>
		{/each}
	</div>

	<div class="mt-8 rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
		<p>
			Configure your school's timetable structure and academic calendar to get started with Planck.
		</p>
	</div>
</div>
