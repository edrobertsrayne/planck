<script lang="ts">
	import { enhance } from '$app/forms';
	import LessonPlanEditor from '$lib/components/LessonPlanEditor.svelte';
	import ResourceLinks from '$lib/components/ResourceLinks.svelte';
	import ResourceFiles from '$lib/components/ResourceFiles.svelte';
	import { subjectTint } from '$lib/colour';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<a
	href="/courses/{data.lesson.courseId}/modules/{data.lesson.moduleId}"
	class="mb-3.5 inline-flex items-center gap-1.5 rounded-control border border-line bg-white px-3 py-1.5 text-[13.5px] font-semibold text-grey-2 hover:bg-field"
>
	<svg
		width="16"
		height="16"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"><path d="m15 18-6-6 6-6"></path></svg
	>
	<span>{data.lesson.moduleName}</span>
</a>

<div class="mb-3 flex items-center gap-2.5">
	<span
		class="rounded-full px-2.5 py-1 text-xs font-bold"
		style="background:{subjectTint(data.lesson.colour).soft};color:{subjectTint(data.lesson.colour)
			.text}"
	>
		{data.lesson.courseName}
	</span>
	<span class="text-[13px] text-grey-3">{data.lesson.moduleName}</span>
</div>

<form method="POST" action="?/rename" use:enhance>
	<input
		name="title"
		value={data.lesson.title}
		placeholder="Untitled lesson"
		aria-label="Lesson title"
		class="mb-1.5 w-full bg-transparent font-display text-[33px] font-medium tracking-[-0.015em] text-ink outline-none"
		onblur={(e) => e.currentTarget.form?.requestSubmit()}
	/>
</form>
<form method="POST" action="?/saveNote" use:enhance>
	<input
		name="note"
		value={data.lesson.note ?? ''}
		placeholder="Add a one-line objective…"
		aria-label="Lesson objective"
		class="mb-4 w-full bg-transparent text-[15px] text-grey-2 outline-none"
		onblur={(e) => e.currentTarget.form?.requestSubmit()}
	/>
</form>

<div class="flex flex-wrap items-start gap-7">
	<div class="min-w-[320px] flex-[3_1_420px]">
		<div class="rounded-card border border-line bg-white shadow-[0_1px_2px_rgba(43,37,48,0.03)]">
			<div class="flex items-center gap-2 border-b border-line px-[18px] py-3.5">
				<span class="flex text-pink-dk">
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.9"
						stroke-linecap="round"
						stroke-linejoin="round"
						><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"
						></path></svg
					>
				</span>
				<span class="text-[13px] font-bold whitespace-nowrap text-grey-1">Lesson plan</span>
				<span class="ml-auto flex items-center gap-1.5 text-xs text-grey-3">
					<span class="h-1.5 w-1.5 rounded-full bg-[#6FB287]"></span>Saved automatically
				</span>
			</div>
			<div class="p-0">
				<LessonPlanEditor value={data.lesson.plan} saveAction="?/savePlan" />
			</div>
		</div>
	</div>

	<aside class="flex min-w-[280px] flex-[1_1_300px] flex-col gap-4.5">
		<section
			class="rounded-card border border-line bg-white p-[18px] shadow-[0_1px_2px_rgba(43,37,48,0.03)]"
		>
			<div class="mb-3.5 flex items-center gap-2">
				<span class="flex text-[#5B86C4]">
					<svg
						width="17"
						height="17"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.9"
						stroke-linecap="round"
						stroke-linejoin="round"
						><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5"></path><path
							d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"
						></path></svg
					>
				</span>
				<h3 class="m-0 text-[14.5px] font-bold text-ink">Web links</h3>
				<span class="ml-auto text-xs text-grey-3">{data.links.length}</span>
			</div>
			<ResourceLinks links={data.links} />
		</section>

		<section
			class="rounded-card border border-line bg-white p-[18px] shadow-[0_1px_2px_rgba(43,37,48,0.03)]"
		>
			<div class="mb-3.5 flex items-center gap-2">
				<span class="flex text-[#8775C6]">
					<svg
						width="17"
						height="17"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.9"
						stroke-linecap="round"
						stroke-linejoin="round"
						><path d="M14 3v5h5"></path><path
							d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"
						></path></svg
					>
				</span>
				<h3 class="m-0 text-[14.5px] font-bold text-ink">Files</h3>
				<span class="ml-auto text-xs text-grey-3">{data.files.length}</span>
			</div>
			<ResourceFiles files={data.files} ownerType="lesson" ownerId={data.lesson.id} />
		</section>
	</aside>
</div>
