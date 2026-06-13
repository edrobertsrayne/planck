<script lang="ts">
	let { message }: { message: string } = $props();
</script>

<div class="rounded-card border border-dashed border-line bg-field/40 px-6 py-10 text-center">
	<svg
		class="mx-auto mb-3 text-pink-200"
		width="28"
		height="28"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
	>
		<rect x="3" y="4" width="18" height="17" rx="2" />
		<path d="M3 9h18M8 2v4M16 2v4" />
	</svg>
	<p class="text-sm text-muted">{message}</p>
</div>
