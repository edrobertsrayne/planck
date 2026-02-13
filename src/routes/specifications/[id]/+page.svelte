<script lang="ts">
	/* eslint-disable svelte/prefer-svelte-reactivity */
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	import AttachmentList from '$lib/components/attachments/attachment-list.svelte';
	import AttachmentForm from '$lib/components/attachments/attachment-form.svelte';
	import Button from '$lib/components/ui/button/button.svelte';

	let { data }: { data: PageData } = $props();

	// Track which topics are expanded
	let expandedTopics = $state(new Set<string>());
	let showAttachmentForm = $state(false);
	let errorMessage = $state('');
	let successMessage = $state('');

	function toggleTopic(topicId: string) {
		if (expandedTopics.has(topicId)) {
			expandedTopics.delete(topicId);
		} else {
			expandedTopics.add(topicId);
		}
		// Create new Set to trigger reactivity
		expandedTopics = new Set(expandedTopics);
	}

	async function handleDeleteAttachment(id: string) {
		const formData = new FormData();
		formData.append('id', id);

		const response = await fetch('?/deleteAttachment', {
			method: 'POST',
			body: formData
		});

		if (response.ok) {
			successMessage = 'Attachment deleted successfully';
			errorMessage = '';
			await invalidateAll();
		} else {
			errorMessage = 'Failed to delete attachment';
			successMessage = '';
		}

		setTimeout(() => {
			errorMessage = '';
			successMessage = '';
		}, 3000);
	}

	function handleAttachmentSuccess() {
		showAttachmentForm = false;
		successMessage = 'Attachment added successfully';
		errorMessage = '';
		invalidateAll();

		setTimeout(() => {
			successMessage = '';
		}, 3000);
	}

	function handleAttachmentError(message: string) {
		errorMessage = message;
		successMessage = '';

		setTimeout(() => {
			errorMessage = '';
		}, 3000);
	}
</script>

<div class="container mx-auto p-6">
	<div class="mb-6">
		<a href={resolve('/specifications')} class="text-sm text-indigo-600 hover:text-indigo-800">
			← Back to Specifications
		</a>
		<h1 class="mt-2 text-3xl font-bold">{data.spec.name}</h1>
		<div class="mt-2 flex gap-4 text-sm text-gray-600">
			<p><span class="font-medium">Board:</span> {data.spec.board}</p>
			<p><span class="font-medium">Level:</span> {data.spec.level}</p>
			{#if data.spec.specCode}
				<p><span class="font-medium">Code:</span> {data.spec.specCode}</p>
			{/if}
			{#if data.spec.specYear}
				<p><span class="font-medium">Year:</span> {data.spec.specYear}</p>
			{/if}
		</div>
	</div>

	<!-- Attachments Section -->
	<div class="mb-6 rounded-lg border border-gray-200 bg-white p-6">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-xl font-semibold">Specification Documents</h2>
			<Button onclick={() => (showAttachmentForm = !showAttachmentForm)}>
				{showAttachmentForm ? 'Cancel' : 'Add Document'}
			</Button>
		</div>

		{#if errorMessage}
			<div class="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800">
				{errorMessage}
			</div>
		{/if}

		{#if successMessage}
			<div class="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-800">
				{successMessage}
			</div>
		{/if}

		{#if showAttachmentForm}
			<div class="mb-4">
				<AttachmentForm
					entityType="spec"
					entityId={data.spec.id}
					onSuccess={handleAttachmentSuccess}
					onError={handleAttachmentError}
				/>
			</div>
		{/if}

		<AttachmentList attachments={data.attachments} onDelete={handleDeleteAttachment} />
	</div>

	{#if data.topics.length === 0}
		<div class="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
			<p class="text-gray-600">No topics found for this specification.</p>
		</div>
	{:else}
		<div class="space-y-4">
			{#each data.topics as topic (topic.id)}
				<div class="rounded-lg border border-gray-200 bg-white">
					<button
						onclick={() => toggleTopic(topic.id)}
						class="flex w-full items-center gap-2 p-4 text-left transition-colors hover:bg-gray-50"
					>
						{#if expandedTopics.has(topic.id)}
							<svg
								class="h-5 w-5 flex-shrink-0 text-gray-500"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
							>
								<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
							</svg>
						{:else}
							<svg
								class="h-5 w-5 flex-shrink-0 text-gray-500"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
							>
								<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
							</svg>
						{/if}
						<div class="flex-1">
							<h3 class="font-semibold">
								{#if topic.code}
									<span class="text-gray-500">{topic.code}</span>
								{/if}
								{topic.name}
							</h3>
							{#if topic.description}
								<p class="mt-1 text-sm text-gray-600">{topic.description}</p>
							{/if}
						</div>
					</button>

					{#if expandedTopics.has(topic.id)}
						<div class="border-t border-gray-200 p-4">
							{#if topic.specPoints.length > 0}
								<div class="space-y-3">
									{#each topic.specPoints as sp (sp.id)}
										<div class="rounded-md bg-gray-50 p-3">
											<div class="flex items-start gap-2">
												<span class="font-mono text-sm font-medium text-indigo-600">
													{sp.reference}
												</span>
												<div class="flex-1">
													<p class="text-sm">{sp.content}</p>
													{#if sp.notes}
														<p class="mt-1 text-xs text-gray-500">{sp.notes}</p>
													{/if}
													{#if sp.tier && sp.tier !== 'both'}
														<span
															class="mt-1 inline-block rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800"
														>
															{sp.tier} tier only
														</span>
													{/if}
													{#if sp.linkedLessons.length > 0}
														<div class="mt-2 border-t border-gray-200 pt-2">
															<p class="text-xs font-medium text-gray-700">Linked Lessons:</p>
															<ul class="mt-1 space-y-1">
																{#each sp.linkedLessons as link (link.lessonId)}
																	<li class="text-xs text-gray-600">
																		<a
																			href={resolve(`/modules/${link.moduleId}`)}
																			class="text-indigo-600 hover:text-indigo-800"
																		>
																			{link.moduleName}
																		</a>
																		→ {link.lessonTitle}
																	</li>
																{/each}
															</ul>
														</div>
													{/if}
												</div>
											</div>
										</div>
									{/each}
								</div>
							{/if}

							{#if topic.children.length > 0}
								<div class="mt-4 space-y-2 pl-4">
									<p class="text-sm font-medium text-gray-700">Subtopics:</p>
									{#each topic.children as child (child.id)}
										<div class="rounded border border-gray-200 bg-white p-3">
											<h4 class="text-sm font-medium">
												{#if child.code}
													<span class="text-gray-500">{child.code}</span>
												{/if}
												{child.name}
											</h4>
											{#if child.description}
												<p class="mt-1 text-xs text-gray-600">{child.description}</p>
											{/if}
											{#if child.specPoints.length > 0}
												<div class="mt-2 space-y-2">
													{#each child.specPoints as sp (sp.id)}
														<div class="rounded-sm bg-gray-50 p-2">
															<div class="flex items-start gap-2">
																<span class="font-mono text-xs font-medium text-indigo-600">
																	{sp.reference}
																</span>
																<div class="flex-1">
																	<p class="text-xs">{sp.content}</p>
																	{#if sp.linkedLessons.length > 0}
																		<div class="mt-1">
																			<p class="text-xs font-medium text-gray-600">Lessons:</p>
																			<ul class="mt-0.5 space-y-0.5">
																				{#each sp.linkedLessons as link (link.lessonId)}
																					<li class="text-xs text-gray-600">
																						<a
																							href={resolve(`/modules/${link.moduleId}`)}
																							class="text-indigo-600 hover:text-indigo-800"
																						>
																							{link.moduleName}
																						</a>
																						→ {link.lessonTitle}
																					</li>
																				{/each}
																			</ul>
																		</div>
																	{/if}
																</div>
															</div>
														</div>
													{/each}
												</div>
											{/if}
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
