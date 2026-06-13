<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Card from '$lib/components/Card.svelte';
	import LessonPlanEditor from '$lib/components/LessonPlanEditor.svelte';
	import LessonLinks from '$lib/components/LessonLinks.svelte';
	import LessonFiles from '$lib/components/LessonFiles.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<a href="/classes/{data.lesson.classId}" class="text-sm font-medium text-pink-dk hover:underline"
	>← {data.lesson.className}</a
>
<PageHeader title={data.lesson.title} subtitle={data.lesson.courseName} />

<Card class="mb-6">
	<h2 class="mb-3 font-display text-lg font-semibold">Lesson plan</h2>
	<LessonPlanEditor value={data.lesson.plan} saveAction="?/savePlan" />
</Card>

<Card class="mb-6">
	<h2 class="mb-3 font-display text-lg font-semibold">Links</h2>
	<LessonLinks links={data.links} />
</Card>

<Card>
	<h2 class="mb-3 font-display text-lg font-semibold">Files</h2>
	<LessonFiles files={data.files} ownerType="scheduled" ownerId={data.lesson.id} />
</Card>
