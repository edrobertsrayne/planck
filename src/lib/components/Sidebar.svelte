<script lang="ts">
	import { page } from '$app/state';
	let {
		classes,
		onsignout
	}: { classes: { id: number; name: string; colour: string }[]; onsignout: () => void } = $props();
	const nav = [
		{ href: '/agenda', label: 'Agenda' },
		{ href: '/calendar', label: 'Calendar' },
		{ href: '/timetable', label: 'Timetable' },
		{ href: '/courses', label: 'Courses' }
	];
	function active(href: string) {
		return page.url.pathname === href || page.url.pathname.startsWith(href + '/');
	}
	const item =
		'flex items-center gap-[11px] rounded-[10px] px-[11px] py-[9px] text-[14.5px] transition';
</script>

{#snippet navIcon(href: string)}
	<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
		{#if href === '/agenda'}
			<path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3.5 6h.01" /><path d="M3.5 12h.01" /><path d="M3.5 18h.01" />
		{:else if href === '/calendar'}
			<rect x="3" y="4.5" width="18" height="16.5" rx="3" /><path d="M3 9h18" /><path d="M8 2.5v4" /><path d="M16 2.5v4" />
		{:else if href === '/timetable'}
			<rect x="3" y="4.5" width="18" height="16.5" rx="3" /><path d="M3 10h18" /><path d="M9 10v11" /><path d="M15 10v11" />
		{:else}
			<rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" />
		{/if}
	</svg>
{/snippet}

<aside class="flex w-64 shrink-0 flex-col border-r border-line bg-[#FAF6F7] p-4 max-md:w-[200px]">
	<a href="/agenda" class="flex items-center gap-[11px] px-2 pt-1 pb-[22px]">
		<span class="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-pink shadow-[0_5px_14px_-6px_rgba(201,86,128,0.6)]">
			<span class="mt-0.5 font-display text-[20px] font-semibold leading-none text-white">P</span>
		</span>
		<span class="font-display text-[22px] font-semibold tracking-[-0.01em] text-ink">Planck</span>
	</a>

	<nav class="flex flex-col gap-[3px]">
		<span class="px-2.5 pt-1.5 pb-1 text-[11px] font-bold tracking-[0.06em] text-grey-4 uppercase">Planner</span>
		{#each nav as n (n.href)}
			<a
				href={n.href}
				class={item}
				class:bg-pink-100={active(n.href)}
				class:font-bold={active(n.href)}
				style:color={active(n.href) ? 'var(--color-pink-dk)' : 'var(--color-grey-1)'}
			>
				{@render navIcon(n.href)}
				{n.label}
			</a>
		{/each}
	</nav>

	<div class="mt-[22px]">
		<div class="flex items-center justify-between px-2.5 pt-1.5 pb-1">
			<span class="text-[11px] font-bold tracking-[0.06em] text-grey-4 uppercase">My classes</span>
			<a href="/classes" title="Manage classes" class="flex h-[22px] w-[22px] items-center justify-center rounded-[7px] bg-tray text-pink-dk">
				<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
			</a>
		</div>
		<div class="mt-1 flex flex-col gap-px">
			{#each classes as c (c.id)}
				<a href="/classes/{c.id}" class="flex items-center gap-2.5 rounded-[9px] px-2.5 py-[7px] text-sm text-grey-1 transition hover:bg-tray" class:bg-pink-100={active('/classes/' + c.id)}>
					<span class="h-[9px] w-[9px] shrink-0 rounded-[3px]" style="background:{c.colour}"></span>
					<span class="truncate">{c.name}</span>
				</a>
			{/each}
		</div>
	</div>

	<div class="mt-auto flex flex-col gap-0.5 border-t border-line pt-3">
		<a href="/settings" class={item} class:bg-pink-100={active('/settings')} style:color={active('/settings') ? 'var(--color-pink-dk)' : 'var(--color-grey-1)'}>
			<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h16" /><circle cx="9" cy="8" r="2.4" /><path d="M4 16h16" /><circle cx="15" cy="16" r="2.4" /></svg>
			Settings
		</a>
		<button type="button" onclick={onsignout} class={`${item} text-grey-3 hover:bg-pink-50 hover:text-pink`}>
			<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></svg>
			Log out
		</button>
	</div>
</aside>
