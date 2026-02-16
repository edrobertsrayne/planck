<script lang="ts">
	import { browser } from '$app/environment';
	import { Palette } from 'lucide-svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as RadioGroup from '$lib/components/ui/radio-group/index.js';
	import { Label } from '$lib/components/ui/label';
	import {
		type AccentColor,
		accentOptions,
		getStoredAccentColor,
		setStoredAccentColor,
		applyAccentColor
	} from '$lib/utils/accent-color';

	let selectedAccent = $state<AccentColor>('amber');

	// Initialize from localStorage on mount
	$effect(() => {
		if (browser) {
			selectedAccent = getStoredAccentColor();
		}
	});

	function handleAccentChange(value: string | undefined) {
		if (!value) return;
		selectedAccent = value as AccentColor;
		setStoredAccentColor(selectedAccent);
	}

	// Re-apply colors when theme changes (light/dark mode toggle)
	$effect(() => {
		if (browser) {
			const observer = new MutationObserver((mutations) => {
				for (const mutation of mutations) {
					if (
						mutation.type === 'attributes' &&
						mutation.attributeName === 'class' &&
						mutation.target === document.documentElement
					) {
						applyAccentColor(selectedAccent);
					}
				}
			});

			observer.observe(document.documentElement, {
				attributes: true,
				attributeFilter: ['class']
			});

			return () => observer.disconnect();
		}
	});
</script>

<div class="container mx-auto max-w-4xl p-4 sm:p-6">
	<div class="mb-6 flex items-center gap-3 sm:mb-8">
		<Palette class="h-8 w-8 text-primary" />
		<h1 class="font-display text-3xl font-semibold sm:text-4xl">Appearance</h1>
	</div>

	<Card.Root>
		<Card.Header>
			<Card.Title>Accent Color</Card.Title>
			<Card.Description>
				Choose your preferred accent color. This will be used for buttons, links, and active states
				throughout the app.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<RadioGroup.Root value={selectedAccent} onValueChange={handleAccentChange}>
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each Object.entries(accentOptions) as [value, option] (value)}
						<div class="flex items-start space-x-3">
							<RadioGroup.Item {value} id={value} />
							<Label
								for={value}
								class="flex flex-1 cursor-pointer items-center gap-3 text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
							>
								<div
									class="h-8 w-8 rounded-lg border border-border"
									style:background-color={option.light.primary}
								></div>
								<span>{option.name}</span>
							</Label>
						</div>
					{/each}
				</div>
			</RadioGroup.Root>
		</Card.Content>
	</Card.Root>

	<div class="mt-6 rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
		<p>
			Your accent color preference is saved locally and will persist across sessions. The selected
			color adapts automatically when switching between light and dark modes.
		</p>
	</div>
</div>
