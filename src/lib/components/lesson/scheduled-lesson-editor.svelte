<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import Textarea from '$lib/components/ui/textarea/textarea.svelte';
	import Label from '$lib/components/ui/label/label.svelte';
	import Checkbox from '$lib/components/ui/checkbox/checkbox.svelte';

	let {
		title = $bindable(''),
		content = $bindable(''),
		duration = $bindable(1),
		specPointIds = $bindable([]),
		availableSpecPoints = [],
		showSpecPointPicker = $bindable(false),
		onCancel,
		onSave
	}: {
		title: string;
		content: string;
		duration: number;
		specPointIds: string[];
		availableSpecPoints: Array<{ id: string; reference: string; content: string }>;
		showSpecPointPicker: boolean;
		onCancel: () => void;
		onSave: (data: { title: string; content: string; duration: number }) => void;
	} = $props();

	function handleSubmit(e: Event) {
		e.preventDefault();
		onSave({ title, content, duration });
	}

	function toggleSpecPoint(specPointId: string) {
		if (specPointIds.includes(specPointId)) {
			specPointIds = specPointIds.filter((id) => id !== specPointId);
		} else {
			specPointIds = [...specPointIds, specPointId];
		}
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
			<Label for="content">Content (Markdown)</Label>
			<Textarea
				id="content"
				name="content"
				bind:value={content}
				rows={6}
				placeholder="Use markdown for formatting..."
				class="mt-2 font-mono text-sm"
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

		<div>
			<div class="mb-2 flex items-center justify-between">
				<span class="text-sm font-medium">Specification Points</span>
				{#if availableSpecPoints.length > 0}
					<Button
						type="button"
						size="sm"
						variant="outline"
						onclick={() => (showSpecPointPicker = !showSpecPointPicker)}
					>
						{showSpecPointPicker ? 'Hide' : 'Manage'} Spec Points
					</Button>
				{/if}
			</div>

			{#if specPointIds.length > 0}
				<div class="mb-2 space-y-1">
					{#each specPointIds as specPointId (specPointId)}
						{@const specPoint = availableSpecPoints.find((sp) => sp.id === specPointId)}
						{#if specPoint}
							<div
								class="flex items-center justify-between rounded bg-background px-2 py-1 text-sm"
							>
								<span class="font-mono text-xs">{specPoint.reference}</span>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onclick={() => toggleSpecPoint(specPointId)}
									class="h-auto p-1 text-destructive hover:text-destructive"
								>
									Remove
								</Button>
							</div>
						{/if}
					{/each}
				</div>
			{/if}

			{#if showSpecPointPicker && availableSpecPoints.length > 0}
				<div
					class="max-h-60 space-y-1 overflow-y-auto rounded border border-border bg-background p-2"
				>
					{#each availableSpecPoints as specPoint (specPoint.id)}
						<label class="flex cursor-pointer items-start gap-2 rounded p-2 hover:bg-muted">
							<Checkbox
								checked={specPointIds.includes(specPoint.id)}
								onCheckedChange={() => toggleSpecPoint(specPoint.id)}
								class="mt-1"
							/>
							<div class="flex-1">
								<p class="font-mono text-xs font-medium">{specPoint.reference}</p>
								<p class="text-xs text-muted-foreground">{specPoint.content}</p>
							</div>
						</label>
					{/each}
				</div>
			{/if}
		</div>

		<div class="flex justify-end gap-2">
			<Button type="button" variant="outline" onclick={onCancel}>Cancel</Button>
			<Button type="submit">Save Changes</Button>
		</div>
	</form>
</div>
