<script lang="ts">
	let { message }: { message: string } = $props();
</script>

<div
	class="flex flex-col items-center justify-center rounded-card border border-dashed border-line bg-white px-6 py-14 text-center"
>
	<span
		class="mb-3.5 flex h-12 w-12 items-center justify-center rounded-[14px] bg-pink-100 text-pink-200"
	>
		<svg
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.7"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<rect x="3" y="4.5" width="18" height="16.5" rx="3" /><path d="M3 9h18" /><path
				d="M8 2.5v4"
			/><path d="M16 2.5v4" />
		</svg>
	</span>
	<p class="text-sm text-grey-3">{message}</p>
</div>
