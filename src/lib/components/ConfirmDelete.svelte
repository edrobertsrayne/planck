<script lang="ts">
	import type { Snippet } from 'svelte';
	import { enhance } from '$app/forms';
	import Modal from '$lib/components/Modal.svelte';
	import Button from '$lib/components/Button.svelte';
	import {
		deletionMessage,
		type DeletionImpact,
		type DeletionType
	} from '$lib/resources/deletion-message';

	let {
		type,
		id,
		name,
		action = '?/delete',
		trigger
	}: {
		type: DeletionType;
		id: number;
		name: string;
		action?: string;
		trigger: Snippet<[() => void]>;
	} = $props();

	let open = $state(false);
	let impact = $state<DeletionImpact | null>(null);

	async function show() {
		open = true;
		impact = null;
		const res = await fetch(`/api/deletion-impact?type=${type}&id=${id}`);
		if (res.ok) impact = await res.json();
	}

	function close() {
		open = false;
	}
</script>

{@render trigger(show)}

{#if open}
	<Modal onclose={close}>
		<div class="p-[22px]">
			<h2 class="m-0 font-display text-xl font-medium text-ink">Delete {name}?</h2>
			<p class="m-0 mt-2 text-[14px] text-grey-2">
				{impact ? deletionMessage(type, impact) : 'Calculating what will be removed…'}
			</p>
		</div>
		<div class="flex items-center justify-end gap-3 border-t border-line p-[18px]">
			<Button variant="secondary" onclick={close}>Cancel</Button>
			<form
				method="POST"
				{action}
				use:enhance={() => {
					return async ({ update }) => {
						await update();
						close();
					};
				}}
			>
				<input type="hidden" name="id" value={id} />
				<Button type="submit" variant="danger">Delete</Button>
			</form>
		</div>
	</Modal>
{/if}
