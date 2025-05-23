<script lang="ts">
	import { browser } from '$app/environment';
	import MatchTable from '$lib/components/app/MatchTable.svelte';
	import Modal from '$lib/components/bootstrap/Modal.svelte';
	import { App } from '$lib/model/app/app.js';
	import { onMount } from 'svelte';
	import type { CompLevel } from 'tatorscout/tba';
	import { globalData } from '$lib/model/app/global-data.svelte.js';
	import { AppData } from '$lib/model/app/data-pull.js';
	import Comments from '$lib/components/app/Comments.svelte';
	import AppView from '$lib/components/app/App.svelte';
	import { goto } from '$app/navigation';
	import createApp from '$lib/model/app/apps/2025.js';
	import PostApp from '$lib/components/app/PostApp.svelte';
	import { getAlliance, MatchData } from '$lib/model/app/match-data.js';
	import { fullscreen, isFullscreen } from '$lib/utils/fullscreen.js';
	import { Form } from '$lib/utils/form.js';
	import { confirm, prompt } from '$lib/utils/prompts.js';

	const { data } = $props();
	const eventKey = $derived(data.eventKey);
	const match = $derived(parseInt(data.match));
	const team = $derived(parseInt(data.team));
	const compLevel = $derived(data.compLevel) as CompLevel;
	const year = $derived(data.year);

	let alliance: 'red' | 'blue' | null = $state(null);
	let page: 'app' | 'post' = $state('app');
	let accounts: string[] = $state([]);
	let app: App | undefined = $state(undefined);
	let matches: Modal;
	let settings: Modal;
	let upload: Modal;
	let postApp: PostApp | undefined = $state(undefined);
	let group = $state(-1);
	let matchData: MatchData | undefined = $state(undefined);

	$effect(() => {
		if (!browser) return;
		localStorage.setItem('scout', globalData.scout);
		localStorage.setItem('prescouting', globalData.prescouting ? 'true' : 'false');
		localStorage.setItem('practice', globalData.practice ? 'true' : 'false');
		localStorage.setItem('flipX', globalData.flipX ? 'true' : 'false');
		localStorage.setItem('flipY', globalData.flipY ? 'true' : 'false');
	});

	$effect(() => {
		if (page === 'post') app?.pause();
	});

	// console.log(app);
	// let deinit = () => {};

	$effect(() => {
		if (group === -1) return;
		// setAlliance();
	});

	const setAlliance = () => {
		if (!browser) return;
		getAlliance({
			eventKey,
			match,
			team,
			compLevel
		}).then((res) => {
			if (!res.isOk()) return console.error(res.error);
			alliance = res.value;
			app?.matchData.set({
				eventKey,
				match,
				team,
				compLevel,
				alliance
			});
		});
	};

	const algaeHarvestForm = async () => {
		if (await confirm('Can this robot harvest algae?')) {
			const howWell = await prompt(
				'How well did the robot harvest algae? Be descriptive and critical.'
			);

			console.log(howWell);
			if (howWell) {
				app?.comments.get('Algae')?.set(['Algae', howWell]);
				console.log('Algae', howWell);
			}
			app?.checks.get('harvestsAlgae')?.update((a) => ({
				...a,
				value: true
			}));
		}
	};

	onMount(() => {
		// deinit();

		// deinit = app.init(target);
		// app.start();
		// app.clickPoints(3);
		app = createApp({
			eventKey,
			match,
			team,
			compLevel,
			alliance
		});

		matchData = app.matchData;

		app.matchData.getScoutGroup().then((d) => {
			if (d.isErr()) return console.error(d.error);
			if (d.value === null) return;
			group = d.value;
		});

		setAlliance();

		AppData.getAccounts().then((data) => {
			if (data.isErr()) return console.error(data.error);
			accounts = data.value.map((a) => a.username);
		});

		const unsub = app.matchData.subscribe(async (d) => {
			const res = await app?.matchData.getScoutGroup();
			if (!res) return;
			if (res.isErr()) return console.error(res.error);
			if (res.value === null) return;
			group = res.value;
		});

		return () => {
			app?.stop();
			unsub();
			// deinit();
		};
	});

	let target: HTMLDivElement;
	let exitFullscreen: () => void;
</script>

<div class="position-relative" style="height: 100vh;" bind:this={target}>
	<div class="d-flex w-100 justify-content-between position-absolute p-3">
		<div class="btn-group" role="group" style="z-index: 300;">
			<button type="button" class="btn px-2 btn-lg" onclick={() => matches.show()}>
				<i class="material-icons"> format_list_numbered </i>
			</button>
			<button type="button" class="btn px-2 btn-lg" onclick={() => settings.show()}>
				<i class="material-icons"> settings </i>
			</button>
			{#if $isFullscreen}
				<button type="button" class="btn px-2 btn-lg" onclick={() => exitFullscreen()}>
					<i class="material-icons">fullscreen_exit</i>
				</button>
			{:else}
				<button
					type="button"
					class="btn px-2 btn-lg"
					onclick={() => (exitFullscreen = fullscreen(document.body))}
				>
					<i class="material-icons">fullscreen</i>
				</button>
			{/if}
		</div>
		<div class="btn-group" role="group" style="z-index: 300;">
			{#if page === 'app'}
				<button
					type="button"
					class="btn btn-primary btn-lg"
					onclick={async () => {
						await algaeHarvestForm();
						page = 'post';
						exitFullscreen();
						if (app) postApp?.render(app);
					}}
				>
					Post Match
				</button>
			{:else if page === 'post'}
				<button type="button" class="btn btn-primary btn-lg" onclick={() => (page = 'app')}>
					App
				</button>
			{/if}
		</div>
	</div>

	<!-- <div bind:this={target} style="height: 100vh; display: {page === 'app' ? 'block' : 'none'};">
		<h3>Loading...</h3>
	</div> -->
	{#if app}
		<AppView {app} {page} />

		<div style="display: {page === 'post' ? 'block' : 'none'};">
			<Comments {app} />
			<div class="btn-group w-100" role="group">
				<button
					type="button"
					class="btn btn-success"
					onclick={async () => {
						await app?.submit();
						const data = await app?.matchData.next();
						if (!data) return console.error('Could not find next match');
						if (data.isErr()) return console.error(data.error);
						goto(
							`/app/event/${data.value.eventKey}/team/${data.value.team}/match/${data.value.compLevel}/${data.value.match}`
						);
						app?.matchData.set(data.value);
						page = 'app';
						app?.reset();
						console.log(app?.comments.comments);
						// window.location.reload();
					}}
				>
					<i class="material-icons"> file_upload </i>
					Submit Match
				</button>
				<button
					class="btn btn-danger"
					onclick={() => {
						app?.reset();
						page = 'app';
					}}
				>
					<i class="material-icons">delete</i>
					Discard Match
				</button>
			</div>
			<PostApp {app} bind:this={postApp} />
		</div>
	{/if}
</div>

<Modal bind:this={matches} title="Select Match" size="xl">
	{#snippet body()}
		{#if app}
			<MatchTable {app} />
		{:else}
			<p>App not generated yet</p>
		{/if}
	{/snippet}
	{#snippet buttons()}{/snippet}
</Modal>
<Modal bind:this={settings} title="Settings">
	{#snippet body()}
		<div class="container-fluid">
			{#if !['qm', 'qf', 'sf', 'f'].includes(matchData?.compLevel || '')}
				<div class="row mb-3">
					<div class="col">
						<p>
							It looks like you're scouting a match that cannot be identified. Please select the
							alliance you are scouting for.
						</p>
						<div class="btn-group" role="group">
							<input
								class="btn-check"
								type="checkbox"
								name="red"
								id="red"
								checked={alliance === 'red'}
								onchange={() => {
									alliance = 'red';
									app?.matchData.set({
										eventKey,
										match,
										team,
										compLevel,
										alliance
									});
								}}
							/>
							<label for="red" class="btn btn-outline-primary">Red</label>
							<input
								class="btn-check"
								type="checkbox"
								name="blue"
								id="blue"
								checked={alliance === 'blue'}
								onchange={() => {
									alliance = 'blue';
									app?.matchData.set({
										eventKey,
										match,
										team,
										compLevel,
										alliance
									});
								}}
							/>
							<label for="blue" class="btn btn-outline-primary">Blue</label>
						</div>
					</div>
				</div>
			{/if}
			<div class="row mb-3">
				<label for="scout">Scout</label>
				<input
					class="form-control"
					type="text"
					name="scout"
					id="scout"
					bind:value={globalData.scout}
					list="accounts"
				/>
				<datalist id="accounts">
					{#each accounts as a}
						<option value={a}></option>
					{/each}
				</datalist>
			</div>
			<div class="row mb-3">
				<div class="btn-group" role="group">
					<!-- <input
						class="btn-check"
						type="checkbox"
						name="prescouting"
						id="prescouting"
						bind:checked={globalData.prescouting}
					/>
					<label for="prescouting" class="btn btn-outline-primary me-2">Prescouting</label> -->
					<input
						class="btn-check"
						type="checkbox"
						name="practice"
						id="practice"
						bind:checked={globalData.practice}
					/>
					<label for="practice" class="btn btn-outline-primary me-2">Practice</label>
					<input
						class="btn-check"
						type="checkbox"
						name="flip-x"
						id="flip-x"
						bind:checked={globalData.flipX}
					/>
					<label for="flip-x" class="btn btn-outline-primary me-2">Flip X</label>
					<input
						class="btn-check"
						type="checkbox"
						name="flip-y"
						id="flip-y"
						bind:checked={globalData.flipY}
					/>
					<label for="flip-y" class="btn btn-outline-primary">Flip Y</label>
				</div>
			</div>
			<div class="row mb-3">
				Select Group:
				<div class="btn-group" role="group">
					{#key group}
						{#each [0, 1, 2, 3, 4, 5] as g}
							<input
								class="btn-check"
								type="checkbox"
								name="group-{g}"
								id="group-{g}"
								checked={group === g}
								onchange={() => {
									app?.matchData.newScoutGroup(g).then(async (d) => {
										if (d.isErr()) return console.error(d.error);
										const alliance = await getAlliance({
											team: d.value,
											eventKey,
											match,
											compLevel
										});
										if (alliance.isErr()) return console.error(alliance.error);
										app?.matchData.set({
											team: d.value,
											eventKey,
											match,
											compLevel,
											alliance: alliance.value
										});
										goto(`/app/event/${eventKey}/team/${d.value}/match/${compLevel}/${match}`);
									});
								}}
							/>
							<label for="group-{g}" class="btn btn-outline-primary">{g + 1}</label>
						{/each}
					{/key}
				</div>
			</div>
			<div class="row mb-3">
				<button type="button" class="btn btn-secondary" onclick={() => AppData.uploadMatch()}>
					<i class="material-icons">upload</i>
					Upload Matches</button
				>
			</div>
		</div>

		<!-- TODO: Flip x and y -->
	{/snippet}
	{#snippet buttons()}{/snippet}
</Modal>
