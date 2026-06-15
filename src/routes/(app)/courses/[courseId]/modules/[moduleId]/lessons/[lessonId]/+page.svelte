<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Card from '$lib/components/Card.svelte';
	import LessonPlanEditor from '$lib/components/LessonPlanEditor.svelte';
	import ResourceLinks from '$lib/components/ResourceLinks.svelte';
	import ResourceFiles from '$lib/components/ResourceFiles.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<a
	href="/courses/{data.lesson.courseId}/modules/{data.lesson.moduleId}"
	class="text-sm font-medium text-pink-dk hover:underline">← {data.lesson.moduleName}</a
>
<PageHeader title={data.lesson.title} subtitle={data.lesson.courseName} />

<section class="mb-6">
	<LessonPlanEditor value={data.lesson.plan} saveAction="?/savePlan" />
</section>

<Card class="mb-6">
	<h2 class="mb-3 font-display text-lg font-semibold">Links</h2>
	<ResourceLinks links={data.links} />
</Card>

<Card>
	<h2 class="mb-3 font-display text-lg font-semibold">Files</h2>
	<ResourceFiles files={data.files} ownerType="lesson" ownerId={data.lesson.id} />
</Card>
