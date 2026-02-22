<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import Textarea from '$lib/components/ui/textarea/textarea.svelte';
	import Label from '$lib/components/ui/label/label.svelte';

	let {
		title = $bindable(''),
		content = $bindable(''),
		duration = $bindable(1),
		onCancel,
		onSave
	}: {
		title: string;
		content: string;
		duration: number;
		onCancel: () => void;
		onSave: (data: { title: string; content: string; duration: number }) => void;
	} = $props();

	function handleSubmit(e: Event) {
		e.preventDefault();
		onSave({ title, content, duration });
	}
</script>

<div class="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
	<form onsubmit={handleSubmit} class="space-y-4">
		<div>
			<Label for="title">
				Lesson Title <span class="text-red-500">*</span>
			</Label>
			<Input type="text" id="title" name="title" bind:value={title} required class="mt-2" />
		</div>

		<div>
			<Label for="content">Content</Label>
			<Textarea
				id="content"
				name="content"
				bind:value={content}
				rows={6}
				placeholder="Lesson notes..."
				class="mt-2 text-sm"
			/>
		</div>

		<div>
			<Label for="duration">Duration (periods)</Label>
			<Input
				type="number"
				id="duration"
				name="duration"
				bind:value={duration}
				min={1}
				max={10}
				class="mt-2 w-32"
			/>
		</div>

		<div class="flex justify-end gap-2">
			<Button type="button" variant="outline" onclick={onCancel}>Cancel</Button>
			<Button type="submit">Save Changes</Button>
		</div>
	</form>
</div>
