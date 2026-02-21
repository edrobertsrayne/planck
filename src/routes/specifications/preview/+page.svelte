<script lang="ts">
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Card from '$lib/components/ui/card';
	import * as Alert from '$lib/components/ui/alert';
	import * as Accordion from '$lib/components/ui/accordion';
	import { resolve } from '$app/paths';
	import { AlertCircle, ChevronRight, Loader2, Save, Trash2, Plus } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import type { ParsedSpecification, ParseQuality } from '$lib/server/openrouter';

	let { form } = $props();

	// Get parsed data and quality info from navigation state
	let parsed = $state<ParsedSpecification | null>(null);
	let quality = $state<ParseQuality | null>(null);

	onMount(() => {
		const stored = sessionStorage.getItem('planck_parsed_spec');
		if (!stored) {
			goto(resolve('/specifications/new'));
			return;
		}
		try {
			const { parsed: p, quality: q } = JSON.parse(stored);
			parsed = p;
			quality = q || null;
			sessionStorage.removeItem('planck_parsed_spec');
		} catch {
			goto(resolve('/specifications/new'));
		}
	});

	let saving = $state(false);
	let error = $state<string | null>(null);

	// Handle successful save
	$effect(() => {
		if (form && 'success' in form && form.success && 'specId' in form && form.specId) {
			goto(resolve(`/specifications/${form.specId}`));
		}
		if (form?.error) {
			error = form.error;
			saving = false;
		}
	});

	function addTopic() {
		if (!parsed) return;
		parsed.topics.push({
			id: crypto.randomUUID(),
			parentId: null,
			name: '',
			code: '',
			description: null,
			sortOrder: parsed.topics.length
		});
	}

	function removeTopic(index: number) {
		if (!parsed) return;
		const topicId = parsed.topics[index].id;
		// Remove topic and its spec points
		parsed.topics = parsed.topics.filter((_, i) => i !== index);
		parsed.specPoints = parsed.specPoints.filter((sp) => sp.topicId !== topicId);
	}

	function addSpecPoint(topicId: string) {
		if (!parsed) return;
		const topicSpecPoints = parsed.specPoints.filter((sp) => sp.topicId === topicId);
		parsed.specPoints.push({
			topicId,
			reference: '',
			content: '',
			notes: null,
			tier: 'both',
			sortOrder: topicSpecPoints.length
		});
	}

	function removeSpecPoint(index: number) {
		if (!parsed) return;
		parsed.specPoints = parsed.specPoints.filter((_, i) => i !== index);
	}

	function getTopicSpecPoints(topicId: string) {
		if (!parsed) return [];
		return parsed.specPoints
			.map((sp, index) => ({ ...sp, originalIndex: index }))
			.filter((sp) => sp.topicId === topicId)
			.sort((a, b) => a.sortOrder - b.sortOrder);
	}

	function getTopicsByParent(parentId: string | null) {
		if (!parsed) return [];
		return parsed.topics
			.map((t, index) => ({ ...t, originalIndex: index }))
			.filter((t) => t.parentId === parentId)
			.sort((a, b) => a.sortOrder - b.sortOrder);
	}
</script>

<svelte:head>
	<title>Preview Specification - Planck</title>
</svelte:head>

{#if !parsed}
	<div class="container flex items-center justify-center py-16">
		<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
	</div>
{:else}
	<div class="container max-w-5xl py-8">
		<div class="mb-6">
			<h1 class="text-3xl font-bold">Preview & Edit Specification</h1>
			<p class="mt-2 text-muted-foreground">
				Review the parsed specification data and make any necessary edits before saving
			</p>
		</div>

		{#if quality?.warnings && quality.warnings.length > 0}
			<Alert.Root variant={quality.critical ? 'destructive' : 'default'} class="mb-6">
				<AlertCircle class="h-4 w-4" />
				<Alert.Title>
					{quality.critical ? '⚠️ Critical Issue' : '⚠️ Quality Warning'}
				</Alert.Title>
				<Alert.Description>
					<ul class="list-disc space-y-1 pl-5">
						{#each quality.warnings as warning}
							<li>{warning}</li>
						{/each}
					</ul>
					{#if quality.critical}
						<p class="mt-3 font-medium">
							You can still save this specification and add spec points manually, or
							<a href={resolve('/specifications/new')} class="underline">try parsing again</a>
							with a different PDF.
						</p>
					{/if}
				</Alert.Description>
			</Alert.Root>
		{/if}

		{#if error}
			<Alert.Root variant="destructive" class="mb-6">
				<AlertCircle class="h-4 w-4" />
				<Alert.Title>Error</Alert.Title>
				<Alert.Description>{error}</Alert.Description>
			</Alert.Root>
		{/if}

		<form
			method="POST"
			action="?/save"
			use:enhance={() => {
				saving = true;
				error = null;
				return async ({ update }) => {
					await update();
					saving = false;
				};
			}}
		>
			<!-- Hidden input with JSON data -->
			<input type="hidden" name="data" value={JSON.stringify(parsed)} />

			<!-- Specification Metadata -->
			<Card.Root class="mb-6">
				<Card.Header>
					<Card.Title>Specification Details</Card.Title>
					<Card.Description>Basic information about the specification</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-4">
					<div class="grid grid-cols-2 gap-4">
						<div class="space-y-2">
							<Label for="board">Exam Board *</Label>
							<Input id="board" bind:value={parsed.spec.board} required />
						</div>
						<div class="space-y-2">
							<Label for="level">Level *</Label>
							<select
								id="level"
								bind:value={parsed.spec.level}
								class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
								required
							>
								<option value="GCSE">GCSE</option>
								<option value="A-Level">A-Level</option>
							</select>
						</div>
					</div>
					<div class="space-y-2">
						<Label for="name">Specification Name *</Label>
						<Input id="name" bind:value={parsed.spec.name} required />
					</div>
					<div class="grid grid-cols-2 gap-4">
						<div class="space-y-2">
							<Label for="code">Specification Code *</Label>
							<Input id="code" bind:value={parsed.spec.specCode} required />
						</div>
						<div class="space-y-2">
							<Label for="year">Specification Year *</Label>
							<Input id="year" bind:value={parsed.spec.specYear} required />
						</div>
					</div>
				</Card.Content>
			</Card.Root>

			<!-- Topics and Spec Points -->
			<Card.Root class="mb-6">
				<Card.Header>
					<div class="flex items-center justify-between">
						<div>
							<Card.Title>Topics & Specification Points</Card.Title>
							<Card.Description>
								Hierarchical structure of topics and learning objectives
								{#if parsed}
									<span class="ml-2">
										— <strong>{parsed.specPoints.length}</strong> spec
										{parsed.specPoints.length === 1 ? 'point' : 'points'} found
									</span>
								{/if}
							</Card.Description>
						</div>
						<Button type="button" variant="outline" size="sm" onclick={addTopic}>
							<Plus class="mr-2 h-4 w-4" />
							Add Topic
						</Button>
					</div>
				</Card.Header>
				<Card.Content>
					{#if parsed.topics.length === 0}
						<p class="py-8 text-center text-muted-foreground">
							No topics found. Click "Add Topic" to add one.
						</p>
					{:else}
						<Accordion.Root type="multiple" class="space-y-2">
							{#each getTopicsByParent(null) as topic (topic.id)}
								{@const topicIndex = topic.originalIndex}
								<Accordion.Item value={topic.id} class="rounded-lg border px-4">
									<Accordion.Trigger class="hover:no-underline">
										<div class="flex flex-1 items-center gap-2">
											<ChevronRight class="h-4 w-4 transition-transform" />
											<span class="font-medium">{topic.name || '(Untitled Topic)'}</span>
											{#if topic.code}
												<span class="text-sm text-muted-foreground">({topic.code})</span>
											{/if}
										</div>
									</Accordion.Trigger>
									<Accordion.Content class="space-y-4 pt-4">
										<!-- Topic fields -->
										<div class="grid grid-cols-2 gap-4">
											<div class="space-y-2">
												<Label>Topic Name *</Label>
												<Input bind:value={parsed.topics[topicIndex].name} required />
											</div>
											<div class="space-y-2">
												<Label>Topic Code *</Label>
												<Input bind:value={parsed.topics[topicIndex].code} required />
											</div>
										</div>
										<div class="space-y-2">
											<Label>Description</Label>
											<Textarea
												bind:value={parsed.topics[topicIndex].description}
												placeholder="Optional description"
											/>
										</div>

										<!-- Spec Points for this topic -->
										<div class="space-y-3 border-t pt-4">
											<div class="flex items-center justify-between">
												<h4 class="text-sm font-medium">Specification Points</h4>
												<Button
													type="button"
													variant="outline"
													size="sm"
													onclick={() => addSpecPoint(topic.id)}
												>
													<Plus class="mr-2 h-3 w-3" />
													Add Spec Point
												</Button>
											</div>

											{#each getTopicSpecPoints(topic.id) as specPoint (specPoint.originalIndex)}
												{@const spIndex = specPoint.originalIndex}
												<div class="space-y-3 rounded-lg border bg-muted/50 p-4">
													<div class="flex items-start justify-between gap-4">
														<div class="grid flex-1 grid-cols-2 gap-3">
															<div class="space-y-2">
																<Label class="text-xs">Reference *</Label>
																<Input
																	bind:value={parsed.specPoints[spIndex].reference}
																	required
																	class="h-8"
																/>
															</div>
															<div class="space-y-2">
																<Label class="text-xs">Tier</Label>
																<select
																	bind:value={parsed.specPoints[spIndex].tier}
																	class="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
																>
																	<option value="both">Both</option>
																	<option value="foundation">Foundation</option>
																	<option value="higher">Higher</option>
																</select>
															</div>
														</div>
														<Button
															type="button"
															variant="ghost"
															size="sm"
															onclick={() => removeSpecPoint(spIndex)}
														>
															<Trash2 class="h-4 w-4 text-destructive" />
														</Button>
													</div>
													<div class="space-y-2">
														<Label class="text-xs">Content *</Label>
														<Textarea
															bind:value={parsed.specPoints[spIndex].content}
															required
															class="min-h-[60px]"
														/>
													</div>
													<div class="space-y-2">
														<Label class="text-xs">Notes</Label>
														<Textarea
															bind:value={parsed.specPoints[spIndex].notes}
															placeholder="Optional notes"
															class="min-h-[40px]"
														/>
													</div>
												</div>
											{/each}

											{#if getTopicSpecPoints(topic.id).length === 0}
												<p class="py-4 text-center text-sm text-muted-foreground">
													No spec points for this topic. Click "Add Spec Point" to add one.
												</p>
											{/if}
										</div>

										<!-- Remove topic button -->
										<div class="border-t pt-4">
											<Button
												type="button"
												variant="destructive"
												size="sm"
												onclick={() => removeTopic(topicIndex)}
											>
												<Trash2 class="mr-2 h-4 w-4" />
												Remove Topic
											</Button>
										</div>
									</Accordion.Content>
								</Accordion.Item>
							{/each}
						</Accordion.Root>
					{/if}
				</Card.Content>
			</Card.Root>

			<!-- Action buttons -->
			<div class="flex gap-3">
				<Button type="submit" disabled={saving} class="flex-1">
					{#if saving}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						Saving...
					{:else}
						<Save class="mr-2 h-4 w-4" />
						Save Specification
					{/if}
				</Button>
				<Button type="button" variant="outline" href={resolve('/specifications/new')}>
					Cancel
				</Button>
			</div>
		</form>
	</div>
{/if}
