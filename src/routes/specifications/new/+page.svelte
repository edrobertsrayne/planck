<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { RadioGroup, RadioGroupItem } from '$lib/components/ui/radio-group';
	import * as Card from '$lib/components/ui/card';
	import * as Alert from '$lib/components/ui/alert';
	import { resolve } from '$app/paths';
	import { AlertCircle, Loader2, Upload } from 'lucide-svelte';
	import type { ParsedSpecification, ParseQuality } from '$lib/server/openrouter';

	type ParseStep = 'idle' | 'uploading' | 'extracting' | 'parsing' | 'complete' | 'error';

	let inputMethod = $state<'file' | 'url'>('file');
	let file = $state<File | null>(null);
	let url = $state('');
	let currentStep = $state<ParseStep>('idle');
	let uploadId = $state<string | null>(null);
	let progress = $state({ step: 0, total: 3, message: '' });
	let error = $state<string | null>(null);
	let canRetry = $state(false);
	let parsed = $state<ParsedSpecification | null>(null);
	let quality = $state<ParseQuality | null>(null);

	function handleFileChange(e: Event) {
		const target = e.target as HTMLInputElement;
		file = target.files?.[0] || null;
		error = null;
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = null;

		// Validate input
		if (inputMethod === 'file' && !file) {
			error = 'Please select a PDF file to upload';
			return;
		}
		if (inputMethod === 'url' && !url.trim()) {
			error = 'Please enter a URL';
			return;
		}

		try {
			// Step 1: Upload PDF
			await stepUpload();

			// Step 2: Extract text
			await stepExtract();

			// Step 3: AI parse
			await stepParse();

			// Navigate to preview
			navigateToPreview();
		} catch (err) {
			currentStep = 'error';
			if (err instanceof Error) {
				error = err.message;
			} else {
				error = 'An unexpected error occurred. Please try again.';
			}
			// Allow retry if we got past Step 1
			canRetry = uploadId !== null;
		}
	}

	async function stepUpload() {
		currentStep = 'uploading';
		progress = { step: 1, total: 3, message: 'Uploading PDF...' };

		const formData = new FormData();
		if (inputMethod === 'file' && file) {
			formData.append('file', file);
		} else if (inputMethod === 'url') {
			formData.append('url', url.trim());
		}

		const response = await fetch('/api/parse-specification/upload', {
			method: 'POST',
			body: formData
		});

		if (!response.ok) {
			const data = await response.json();
			throw new Error(data.message || 'Failed to upload PDF');
		}

		const result = await response.json();
		uploadId = result.uploadId;
	}

	async function stepExtract() {
		currentStep = 'extracting';
		progress = { step: 2, total: 3, message: 'Extracting text from PDF...' };

		const response = await fetch('/api/parse-specification/extract', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ uploadId })
		});

		if (!response.ok) {
			const data = await response.json();
			throw new Error(data.message || 'Failed to extract text');
		}

		const result = await response.json();
		console.log(`Extracted ${result.textLength} characters`);
	}

	async function stepParse() {
		currentStep = 'parsing';
		progress = {
			step: 3,
			total: 3,
			message: 'Parsing specification structure (this may take 1-3 minutes)...'
		};

		const response = await fetch('/api/parse-specification/parse', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ uploadId })
		});

		if (!response.ok) {
			const data = await response.json();
			throw new Error(data.message || 'Failed to parse specification');
		}

		const result = await response.json();
		parsed = result.parsed;
		quality = result.quality;
		currentStep = 'complete';
	}

	function navigateToPreview() {
		// Use sessionStorage to pass large parsed data — History API pushState
		// has size limits that cause DataCloneError with large spec payloads
		sessionStorage.setItem('planck_parsed_spec', JSON.stringify({ parsed, quality }));
		goto(resolve('/specifications/preview'));
	}

	async function handleRetry() {
		error = null;

		try {
			// Determine which step to retry from
			const lastCompletedStep = canRetry && uploadId ? 'uploading' : 'idle';

			// If we completed upload, try extract
			if (lastCompletedStep === 'uploading') {
				try {
					await stepExtract();
				} catch {
					// If extract also failed, that's where we'll retry from next time
					throw new Error('Failed to extract text. Please try again.');
				}
			}

			// Continue with parse
			await stepParse();

			// Navigate to preview
			navigateToPreview();
		} catch (err) {
			currentStep = 'error';
			if (err instanceof Error) {
				error = err.message;
			} else {
				error = 'An unexpected error occurred. Please try again.';
			}
		}
	}

	async function handleCancel() {
		if (uploadId) {
			// Cleanup temp files (fire and forget)
			fetch('/api/parse-specification/cleanup', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ uploadId })
			}).catch(console.error);
		}

		// Reset state
		currentStep = 'idle';
		uploadId = null;
		error = null;
		canRetry = false;
		progress = { step: 0, total: 3, message: '' };
	}
</script>

<svelte:head>
	<title>Add Specification - Planck</title>
</svelte:head>

<div class="container max-w-2xl py-8">
	<div class="mb-6">
		<h1 class="text-3xl font-bold">Add Specification</h1>
		<p class="mt-2 text-muted-foreground">
			Upload an exam specification PDF or provide a URL to automatically extract its structure
		</p>
	</div>

	<Card.Root>
		<Card.Header>
			<Card.Title>Parse Specification</Card.Title>
			<Card.Description>Choose how you want to provide the specification document</Card.Description>
		</Card.Header>
		<Card.Content>
			<form onsubmit={handleSubmit} class="space-y-6">
				<!-- Input method selection -->
				<div class="space-y-3">
					<Label>Input Method</Label>
					<RadioGroup bind:value={inputMethod}>
						<div class="flex items-center space-x-2">
							<RadioGroupItem value="file" id="file" />
							<Label for="file" class="cursor-pointer font-normal">Upload PDF File</Label>
						</div>
						<div class="flex items-center space-x-2">
							<RadioGroupItem value="url" id="url" />
							<Label for="url" class="cursor-pointer font-normal">Provide URL</Label>
						</div>
					</RadioGroup>
				</div>

				<!-- File upload -->
				{#if inputMethod === 'file'}
					<div class="space-y-2">
						<Label for="file-input">PDF File</Label>
						<Input
							id="file-input"
							type="file"
							accept=".pdf"
							onchange={handleFileChange}
							disabled={currentStep !== 'idle' && currentStep !== 'error'}
							required
						/>
						<p class="text-sm text-muted-foreground">Maximum file size: 10MB</p>
						{#if file}
							<p class="text-sm text-muted-foreground">
								Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
							</p>
						{/if}
					</div>
				{/if}

				<!-- URL input -->
				{#if inputMethod === 'url'}
					<div class="space-y-2">
						<Label for="url-input">PDF URL</Label>
						<Input
							id="url-input"
							type="url"
							placeholder="https://example.com/specification.pdf"
							bind:value={url}
							disabled={currentStep !== 'idle' && currentStep !== 'error'}
							required
						/>
						<p class="text-sm text-muted-foreground">
							Enter a direct link to a PDF specification document
						</p>
					</div>
				{/if}

				<!-- Progress indicator -->
				{#if currentStep !== 'idle' && currentStep !== 'error' && currentStep !== 'complete'}
					<Card.Root class="border-primary">
						<Card.Content class="pt-6">
							<div class="space-y-4">
								<!-- Progress bar -->
								<div class="space-y-2">
									<div class="flex items-center justify-between text-sm">
										<span class="font-medium">{progress.message}</span>
										<span class="text-muted-foreground">Step {progress.step}/3</span>
									</div>
									<div class="h-2 w-full overflow-hidden rounded-full bg-secondary">
										<div
											class="h-full bg-primary transition-all duration-300"
											style="width: {(progress.step / 3) * 100}%"
										></div>
									</div>
								</div>

								<!-- Loading spinner -->
								<div class="flex items-center gap-2 text-sm text-muted-foreground">
									<Loader2 class="h-4 w-4 animate-spin" />
									<span>Processing...</span>
								</div>

								<!-- Cancel button -->
								<Button variant="outline" size="sm" onclick={handleCancel} class="w-full">
									Cancel
								</Button>
							</div>
						</Card.Content>
					</Card.Root>
				{/if}

				<!-- Error display with retry -->
				{#if error}
					<Alert.Root variant="destructive">
						<AlertCircle class="h-4 w-4" />
						<Alert.Title>Error</Alert.Title>
						<Alert.Description>
							<p class="mb-3">{error}</p>
							{#if canRetry}
								<div class="flex gap-2">
									<Button size="sm" onclick={handleRetry}>
										Retry from Step {currentStep === 'extracting' ? '2' : '3'}
									</Button>
									<Button size="sm" variant="outline" onclick={handleCancel}>Cancel</Button>
								</div>
							{:else}
								<Button size="sm" onclick={handleCancel}>Try Again</Button>
							{/if}
						</Alert.Description>
					</Alert.Root>
				{/if}

				<!-- Info about processing time -->
				{#if currentStep === 'idle'}
					<Alert.Root>
						<AlertCircle class="h-4 w-4" />
						<Alert.Title>Processing Time</Alert.Title>
						<Alert.Description>
							Parsing involves 3 steps: upload, text extraction, and AI analysis. The entire process
							may take 1-3 minutes depending on the specification size.
						</Alert.Description>
					</Alert.Root>
				{/if}

				<!-- Submit button -->
				<div class="flex gap-3">
					<Button
						type="submit"
						disabled={currentStep !== 'idle' && currentStep !== 'error'}
						class="flex-1"
					>
						{#if currentStep !== 'idle' && currentStep !== 'error' && currentStep !== 'complete'}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							Processing...
						{:else}
							<Upload class="mr-2 h-4 w-4" />
							Parse Specification
						{/if}
					</Button>
					<Button type="button" variant="outline" href={resolve('/specifications')}>Cancel</Button>
				</div>
			</form>
		</Card.Content>
	</Card.Root>
</div>
