<script lang="ts">
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import Sidebar from '$lib/components/Sidebar.svelte';
	let { data, children } = $props();
	async function signOut() {
		await authClient.signOut();
		await goto('/login');
	}
</script>

<div class="flex h-screen overflow-hidden">
	<Sidebar classes={data.classes} onsignout={signOut} />
	<main class="min-w-0 flex-1 overflow-y-auto">
		{@render children()}
	</main>
</div>
