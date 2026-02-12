<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';

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
			<label for="title" class="mb-2 block text-sm font-medium text-gray-700">
				Lesson Title <span class="text-red-500">*</span>
			</label>
			<input
				type="text"
				id="title"
				name="title"
				bind:value={title}
				required
				class="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
			/>
		</div>

		<div>
			<label for="content" class="mb-2 block text-sm font-medium text-gray-700">
				Content (Markdown)
			</label>
			<textarea
				id="content"
				name="content"
				bind:value={content}
				rows="6"
				placeholder="Use markdown for formatting..."
				class="block w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
			></textarea>
		</div>

		<div>
			<label for="duration" class="mb-2 block text-sm font-medium text-gray-700">
				Duration (periods)
			</label>
			<input
				type="number"
				id="duration"
				name="duration"
				bind:value={duration}
				min="1"
				max="10"
				class="block w-32 rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
			/>
		</div>

		<div>
			<div class="mb-2 flex items-center justify-between">
				<span class="text-sm font-medium text-gray-700">Specification Points</span>
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
							<div class="flex items-center justify-between rounded bg-white px-2 py-1 text-sm">
								<span class="font-mono text-xs">{specPoint.reference}</span>
								<button
									type="button"
									onclick={() => toggleSpecPoint(specPointId)}
									class="text-red-600 hover:text-red-800"
								>
									Remove
								</button>
							</div>
						{/if}
					{/each}
				</div>
			{/if}

			{#if showSpecPointPicker && availableSpecPoints.length > 0}
				<div class="max-h-60 space-y-1 overflow-y-auto rounded border border-gray-200 bg-white p-2">
					{#each availableSpecPoints as specPoint (specPoint.id)}
						<label class="flex cursor-pointer items-start gap-2 rounded p-2 hover:bg-gray-50">
							<input
								type="checkbox"
								checked={specPointIds.includes(specPoint.id)}
								onchange={() => toggleSpecPoint(specPoint.id)}
								class="mt-1"
							/>
							<div class="flex-1">
								<p class="font-mono text-xs font-medium">{specPoint.reference}</p>
								<p class="text-xs text-gray-600">{specPoint.content}</p>
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
