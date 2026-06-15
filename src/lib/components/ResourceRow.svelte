<script lang="ts">
	import { enhance } from '$app/forms';
	let {
		tileBg,
		tileFg,
		tileText = '',
		iconSvg = '',
		title,
		meta = '',
		href = '',
		deleteAction = '',
		id
	}: {
		tileBg: string;
		tileFg: string;
		tileText?: string;
		iconSvg?: string;
		title: string;
		meta?: string;
		href?: string;
		deleteAction?: string;
		id?: number;
	} = $props();
</script>

<div
	class="flex items-center gap-[11px] rounded-[11px] border border-line px-2.5 py-2.5 transition hover:border-pink-200 hover:bg-field"
>
	<span
		class="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] text-[10.5px] font-extrabold"
		style="background:{tileBg};color:{tileFg}"
	>
		{#if iconSvg}<svg
				width="17"
				height="17"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.8"
				stroke-linecap="round"
				stroke-linejoin="round">{@html iconSvg}</svg
			>{:else}{tileText}{/if}
	</span>
	<div class="min-w-0 flex-1">
		{#if href}
			<a
				{href}
				target="_blank"
				rel="noopener noreferrer"
				class="block truncate text-[13.5px] font-semibold text-ink hover:underline">{title}</a
			>
		{:else}
			<div class="truncate text-[13.5px] font-semibold text-ink">{title}</div>
		{/if}
		{#if meta}<div class="truncate text-xs text-grey-3">{meta}</div>{/if}
	</div>
	{#if deleteAction}
		<form method="POST" action={deleteAction} use:enhance class="shrink-0">
			<input type="hidden" name="id" value={id} />
			<button
				class="flex rounded p-1 text-grey-4 hover:bg-pink-50 hover:text-pink"
				aria-label="Remove"
			>
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.2"
					stroke-linecap="round"
					stroke-linejoin="round"
					><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg
				>
			</button>
		</form>
	{/if}
</div>
