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
		'inline-flex items-center justify-center gap-2 rounded-control font-semibold transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-100';
	const sizes: Record<Size, string> = {
		md: 'h-11 px-4 text-sm',
		sm: 'h-9 px-3.5 text-xs'
	};
	const variants: Record<Variant, string> = {
		primary:
			'bg-pink text-white shadow-[0_8px_20px_-8px_rgba(201,86,128,0.55)] hover:bg-pink-hover',
		secondary: 'border border-line bg-white text-grey-1 hover:border-pink-200',
		ghost: 'bg-transparent text-grey-1 hover:bg-tray',
		danger: 'bg-pink-50 text-pink-dk hover:bg-pink-100'
	};
</script>

<button {type} class={`${base} ${sizes[size]} ${variants[variant]} ${klass}`} {...rest}>
	{@render children?.()}
</button>
