<script lang="ts">
	import type { DayOfWeek } from '$lib/scheduling/dates';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { authClient } from '$lib/auth-client';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import Field from '$lib/components/Field.svelte';

	let { data } = $props();

	const dayNames: { n: DayOfWeek; label: string }[] = [
		{ n: 1, label: 'Mon' },
		{ n: 2, label: 'Tue' },
		{ n: 3, label: 'Wed' },
		{ n: 4, label: 'Thu' },
		{ n: 5, label: 'Fri' },
		{ n: 6, label: 'Sat' },
		{ n: 7, label: 'Sun' }
	];

	const monthNames = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December'
	];

	const inputClass =
		'h-[42px] w-full rounded-control border border-line bg-white px-3.5 text-[14.5px] text-ink focus:border-pink-200 focus:outline-none';
	const fieldInputClass =
		'h-10 min-w-0 flex-1 rounded-control border border-line bg-field px-3 text-sm text-ink focus:border-pink-200 focus:outline-none';

	// --- Account ---
	let email = $state(page.data.user?.email ?? '');
	let currentPassword = $state('');
	let newPassword = $state('');
	let acctMsg = $state('');

	async function saveEmail() {
		acctMsg = '';
		const r = await (
			authClient as unknown as {
				changeEmail: (a: { newEmail: string }) => Promise<{ error?: { message?: string } }>;
			}
		).changeEmail({ newEmail: email });
		acctMsg = r.error
			? (r.error.message ?? 'Email update failed')
			: 'Email updated (check your inbox if verification is required).';
	}

	async function changePassword() {
		acctMsg = '';
		const r = await (
			authClient as unknown as {
				changePassword: (a: {
					currentPassword: string;
					newPassword: string;
					revokeOtherSessions: boolean;
				}) => Promise<{ error?: { message?: string } }>;
			}
		).changePassword({ currentPassword, newPassword, revokeOtherSessions: true });
		acctMsg = r.error ? (r.error.message ?? 'Password change failed') : 'Password changed.';
		currentPassword = '';
		newPassword = '';
	}

	// --- Log out ---
	async function signOut() {
		await authClient.signOut();
		await goto('/login');
	}
</script>

<PageHeader eyebrow="Account & preferences" title="Settings" />

<div class="flex max-w-[780px] flex-col gap-5">
	<!-- Account -->
	<Card>
		<div class="mb-[18px] flex items-center gap-3">
			<span
				class="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-pink-50 text-pink-dk"
			>
				<svg
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.9"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<circle cx="12" cy="8" r="4"></circle>
					<path d="M4 21a8 8 0 0 1 16 0"></path>
				</svg>
			</span>
			<div>
				<h2 class="m-0 text-[16.5px] font-bold text-ink">Account</h2>
				<p class="m-0 mt-0.5 text-[13px] text-grey-3">Update your email and password</p>
			</div>
		</div>
		<div class="flex flex-col gap-4">
			<Field label="Email address">
				<div class="flex gap-2.5">
					<input class={inputClass} type="email" bind:value={email} />
					<Button onclick={saveEmail}>Update</Button>
				</div>
			</Field>
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<Field label="Current password">
					<input
						class={inputClass}
						type="password"
						placeholder="••••••••"
						bind:value={currentPassword}
					/>
				</Field>
				<Field label="New password">
					<input
						class={inputClass}
						type="password"
						placeholder="••••••••"
						bind:value={newPassword}
					/>
				</Field>
			</div>
			<div class="flex items-center justify-between gap-3">
				{#if acctMsg}<p class="m-0 text-[13px] text-grey-2">{acctMsg}</p>{/if}
				<Button class="ml-auto" onclick={changePassword}>Change password</Button>
			</div>
		</div>
	</Card>

	<!-- Timetable -->
	<Card>
		<div class="mb-[18px] flex items-center gap-3">
			<span
				class="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-[#E2ECF7] text-[#3F6AA3]"
			>
				<svg
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.9"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<rect x="3" y="4.5" width="18" height="16.5" rx="3"></rect>
					<path d="M3 9h18"></path>
					<path d="M8 2.5v4"></path>
					<path d="M16 2.5v4"></path>
				</svg>
			</span>
			<div>
				<h2 class="m-0 text-[16.5px] font-bold text-ink">Timetable</h2>
				<p class="m-0 mt-0.5 text-[13px] text-grey-3">Your teaching days and period structure</p>
			</div>
		</div>
		<form method="POST" action="?/saveConfig" use:enhance class="flex flex-col gap-5">
			<div>
				<span class="mb-2.5 block text-[13px] font-semibold text-grey-1">Timetable cycle</span>
				<div class="flex gap-2" role="radiogroup" aria-label="Timetable cycle">
					{#each [{ v: 1, label: '1 week' }, { v: 2, label: '2 weeks' }] as o (o.v)}
						<label
							class={`flex h-9 flex-1 cursor-pointer items-center justify-center rounded-control border text-sm font-semibold transition ${
								data.config.cycleWeeks === o.v
									? 'border-pink-200 bg-pink-50 text-pink-dk'
									: 'border-line bg-white text-grey-2 hover:border-pink-200'
							}`}
						>
							<input
								type="radio"
								name="cycleWeeks"
								value={o.v}
								checked={data.config.cycleWeeks === o.v}
								class="sr-only"
							/>
							{o.label}
						</label>
					{/each}
				</div>
			</div>
			<fieldset>
				<legend class="mb-2.5 block text-[13px] font-semibold text-grey-1">Teaching days</legend>
				<div class="flex flex-wrap gap-[7px]">
					{#each dayNames as d (d.n)}
						<label
							class={`flex h-9 cursor-pointer items-center justify-center rounded-control border px-3.5 text-sm font-semibold transition ${
								data.config.teachingDays.includes(d.n)
									? 'border-pink-200 bg-pink-50 text-pink-dk'
									: 'border-line bg-white text-grey-2 hover:border-pink-200'
							}`}
						>
							<input
								type="checkbox"
								name="teachingDays"
								value={d.n}
								checked={data.config.teachingDays.includes(d.n)}
								class="sr-only"
							/>
							{d.label}
						</label>
					{/each}
				</div>
			</fieldset>
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<Field label="Periods per day">
					<input
						name="periodsPerDay"
						type="number"
						min="1"
						max="10"
						value={data.config.periodsPerDay}
						class={inputClass}
					/>
				</Field>
				<Field label="First teaching week is">
					<select name="anchorLetter" class={inputClass}>
						<option value="A" selected={data.config.anchorLetter === 'A'}>Week A</option>
						<option value="B" selected={data.config.anchorLetter === 'B'}>Week B</option>
					</select>
				</Field>
			</div>
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<Field label="Academic year starts (month)">
					<select name="academicYearStartMonth" class={inputClass}>
						{#each monthNames as name, i (name)}
							<option value={i + 1} selected={data.config.academicYearStartMonth === i + 1}>
								{name}
							</option>
						{/each}
					</select>
				</Field>
				<Field label="Day of month">
					<input
						name="academicYearStartDay"
						type="number"
						min="1"
						max="31"
						value={data.config.academicYearStartDay}
						class={inputClass}
					/>
				</Field>
			</div>
			<div class="flex justify-end">
				<Button type="submit">Save</Button>
			</div>
		</form>
	</Card>

	<!-- Terms -->
	<Card>
		<div class="mb-[18px] flex items-center gap-3">
			<span
				class="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-[#E3F1E7] text-[#3E7C50]"
			>
				<svg
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.9"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M3 7h18"></path>
					<path d="M3 12h18"></path>
					<path d="M3 17h18"></path>
				</svg>
			</span>
			<div>
				<h2 class="m-0 text-[16.5px] font-bold text-ink">Terms</h2>
				<p class="m-0 mt-0.5 text-[13px] text-grey-3">Define your academic year</p>
			</div>
		</div>
		<div class="flex flex-col gap-2">
			{#each data.blocks as b (b.id)}
				<div class="grid grid-cols-[1.4fr_1fr_1fr_34px] items-center gap-2">
					<span class={`${fieldInputClass} flex items-center font-semibold`}>{b.name}</span>
					<span class={`${fieldInputClass} flex items-center text-grey-2`}>{b.startDate}</span>
					<span class={`${fieldInputClass} flex items-center text-grey-2`}>{b.endDate}</span>
					<form method="POST" action="?/deleteBlock" use:enhance>
						<input type="hidden" name="id" value={b.id} />
						<button
							type="submit"
							title="Delete term"
							class="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] text-grey-3 transition hover:bg-pink-50 hover:text-pink-dk"
						>
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2.2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path d="M18 6 6 18"></path>
								<path d="m6 6 12 12"></path>
							</svg>
						</button>
					</form>
				</div>
			{/each}
			<form
				method="POST"
				action="?/addBlock"
				use:enhance
				class="grid grid-cols-[1.4fr_1fr_1fr_34px] items-center gap-2"
			>
				<input name="name" placeholder="Term name" required class={fieldInputClass} />
				<input name="startDate" type="date" required class={fieldInputClass} />
				<input name="endDate" type="date" required class={fieldInputClass} />
				<button
					type="submit"
					title="Add term"
					class="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border-1.5 border-dashed border-line text-grey-3 transition hover:border-pink-200 hover:text-pink-dk"
				>
					<svg
						width="15"
						height="15"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M12 5v14"></path>
						<path d="M5 12h14"></path>
					</svg>
				</button>
			</form>
		</div>
	</Card>

	<!-- School closures -->
	<Card>
		<div class="mb-[18px] flex items-center gap-3">
			<span
				class="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-[#FBE9DD] text-[#B06A3D]"
			>
				<svg
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.9"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<rect x="3" y="4.5" width="18" height="16.5" rx="3"></rect>
					<path d="M3 9h18"></path>
					<path d="m9 14 6 4"></path>
					<path d="m15 14-6 4"></path>
				</svg>
			</span>
			<div>
				<h2 class="m-0 text-[16.5px] font-bold text-ink">School closures</h2>
				<p class="m-0 mt-0.5 text-[13px] text-grey-3">
					Holidays, INSET days and other non-teaching days
				</p>
			</div>
		</div>
		<div class="flex flex-col gap-2">
			{#each data.closures as c (c.id)}
				<div class="grid grid-cols-[1.4fr_1.2fr_34px] items-center gap-2">
					<span class={`${fieldInputClass} flex items-center font-semibold`}>{c.name}</span>
					<span class={`${fieldInputClass} flex items-center text-grey-2`}>{c.date}</span>
					<form method="POST" action="?/deleteClosure" use:enhance>
						<input type="hidden" name="id" value={c.id} />
						<button
							type="submit"
							title="Delete closure"
							class="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] text-grey-3 transition hover:bg-pink-50 hover:text-pink-dk"
						>
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2.2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path d="M18 6 6 18"></path>
								<path d="m6 6 12 12"></path>
							</svg>
						</button>
					</form>
				</div>
			{/each}
			<form
				method="POST"
				action="?/addClosure"
				use:enhance
				class="grid grid-cols-[1.4fr_1.2fr_34px] items-center gap-2"
			>
				<input name="name" placeholder="Closure name" required class={fieldInputClass} />
				<input name="date" type="date" required class={fieldInputClass} />
				<button
					type="submit"
					title="Add closure"
					class="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border-1.5 border-dashed border-line text-grey-3 transition hover:border-pink-200 hover:text-pink-dk"
				>
					<svg
						width="15"
						height="15"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M12 5v14"></path>
						<path d="M5 12h14"></path>
					</svg>
				</button>
			</form>
		</div>
	</Card>

	<!-- Log out -->
	<Card class="flex items-center justify-between gap-4">
		<div>
			<h2 class="m-0 text-[15px] font-bold text-ink">Log out</h2>
			<p class="m-0 mt-0.5 text-[13px] text-grey-3">Sign out of Planck on this device</p>
		</div>
		<Button onclick={signOut} class="bg-pink-50 text-pink-dk shadow-none hover:bg-pink-100">
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
				<path d="m16 17 5-5-5-5"></path>
				<path d="M21 12H9"></path>
			</svg>
			Log out
		</Button>
	</Card>
</div>
