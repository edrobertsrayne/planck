<script lang="ts">
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';

	let mobileMenuOpen = $state(false);

	const navItems = [
		{ href: '/calendar', label: 'Calendar' },
		{ href: '/classes', label: 'Classes' },
		{ href: '/modules', label: 'Modules' },
		{ href: '/specifications', label: 'Specifications' },
		{ href: '/settings', label: 'Settings' }
	];

	function isActive(href: string): boolean {
		const pathname = $page?.url?.pathname ?? '/';
		return pathname === href || pathname.startsWith(`${href}/`);
	}

	function toggleMobileMenu() {
		mobileMenuOpen = !mobileMenuOpen;
	}
</script>

<nav class="border-b bg-background">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="flex h-16 justify-between">
			<div class="flex">
				<div class="flex flex-shrink-0 items-center">
					<a href="/" data-sveltekit-preload-data class="text-xl font-bold">Planck</a>
				</div>
				<!-- Desktop navigation -->
				<div class="hidden sm:ml-6 sm:flex sm:space-x-8">
					{#each navItems as item (item.href)}
						<a
							href={item.href}
							data-sveltekit-preload-data
							class="inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium {isActive(
								item.href
							)
								? 'border-primary text-foreground'
								: 'border-transparent text-muted-foreground hover:border-muted hover:text-foreground'}"
							aria-current={isActive(item.href) ? 'page' : undefined}
						>
							{item.label}
						</a>
					{/each}
				</div>
			</div>
			<!-- Mobile menu button -->
			<div class="flex items-center sm:hidden">
				<Button
					variant="ghost"
					size="icon"
					onclick={toggleMobileMenu}
					aria-label="Toggle mobile menu"
					aria-expanded={mobileMenuOpen}
				>
					<svg
						class="h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="1.5"
						stroke="currentColor"
					>
						{#if mobileMenuOpen}
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						{:else}
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
							/>
						{/if}
					</svg>
				</Button>
			</div>
		</div>
	</div>

	<!-- Mobile menu -->
	{#if mobileMenuOpen}
		<div class="sm:hidden">
			<div class="space-y-1 pt-2 pb-3">
				{#each navItems as item (item.href)}
					<a
						href={item.href}
						data-sveltekit-preload-data
						class="block border-l-4 py-2 pr-4 pl-3 text-base font-medium {isActive(item.href)
							? 'border-primary bg-primary/10 text-primary'
							: 'border-transparent text-muted-foreground hover:border-muted hover:bg-muted/50 hover:text-foreground'}"
						aria-current={isActive(item.href) ? 'page' : undefined}
						onclick={() => (mobileMenuOpen = false)}
					>
						{item.label}
					</a>
				{/each}
			</div>
		</div>
	{/if}
</nav>
