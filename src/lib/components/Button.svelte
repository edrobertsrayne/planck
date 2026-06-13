<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
	type Size = 'md' | 'sm';

	let {
		variant = 'primary',
		size = 'md',
		type = 'button',
		class: klass = '',
		children,
		...rest
	}: {
		variant?: Variant;
		size?: Size;
		class?: string;
		children?: Snippet;
	} & HTMLButtonAttributes = $props();

	const base =
		'inline-flex items-center justify-center gap-2 rounded-control border font-semibold transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-100';
	const sizes: Record<Size, string> = {
		md: 'px-4 py-2 text-sm',
		sm: 'px-3 py-1.5 text-xs'
	};
	const variants: Record<Variant, string> = {
		primary: 'border-transparent bg-pink text-white hover:bg-pink-hover',
		secondary: 'border-pink-200 bg-white text-pink-dk hover:bg-pink-50',
		ghost: 'border-transparent bg-transparent text-ink/70 hover:bg-field',
		danger: 'border-pink-200/60 bg-transparent text-danger hover:bg-pink-50'
	};
</script>

<button {type} class={`${base} ${sizes[size]} ${variants[variant]} ${klass}`} {...rest}>
	{@render children?.()}
</button>
