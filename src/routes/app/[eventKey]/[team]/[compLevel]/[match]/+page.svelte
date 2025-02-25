<script lang="ts">
	import { browser } from '$app/environment';
	import MatchTable from '$lib/components/app/MatchTable.svelte';
	import Modal from '$lib/components/bootstrap/Modal.svelte';
	import { App } from '$lib/model/app/new/app.js';
	import { onMount } from 'svelte';
	import type { CompLevel } from 'tatorscout/tba';
	import { globalData } from '$lib/model/app/new/global-data.svelte.js';
	import { AppData } from '$lib/model/app/new/data-pull.js';
	import Comments from '$lib/components/app/Comments.svelte';

	const { data } = $props();
	const eventKey = $derived(data.eventKey);
	const match = $derived(parseInt(data.match));
	const team = $derived(parseInt(data.team));
	const compLevel = $derived(data.compLevel) as CompLevel;
	const year = $derived(data.year);

	let page: 'app' | 'post' = $state('app');

	let accounts: string[] = $state([]);

	// const alliance = $derived(data.alliance);
	// const exists = $derived(data.exists);

	$effect(() => {
		if (!browser) return;
		localStorage.setItem('scout', globalData.scout);
		localStorage.setItem('prescouting', globalData.prescouting ? 'true' : 'false');
		localStorage.setItem('practice', globalData.practice ? 'true' : 'false');
	});

	// const d = $derived({
	//     eventKey,
	//     match,
	//     team,
	//     compLevel,
	//     year
	// });

	const app = new App({
		eventKey,
		match,
		team,
		compLevel,
		year,
		flipX: false,
		flipY: false
	});
	let deinit = () => {};

	$effect(() => {
		console.log('Regenerating...');
		deinit();
		if (!target || browser) return console.error('Cannot initialize');

		deinit = app.init(target);
		app.start();
		app.clickPoints(3);

		app.matchData.set({
			eventKey,
			match,
			team,
			compLevel
		});
	});

	$inspect(app);

	let target: HTMLDivElement;

	onMount(() => {
		deinit();

		deinit = app.init(target);
		app.start();
		app.clickPoints(3);

		AppData.getAccounts().then((data) => {
			if (data.isErr()) return console.error(data.error);
			accounts = data.value.map((a) => a.username);
		});

		return () => {
			app?.stop();
			deinit();
		};
	});

	let matches: Modal;
	let settings: Modal;
	let upload: Modal;
</script>

<div class="position-relative" style="height: 100vh;">
	<div class="d-flex w-100 justify-content-between position-absolute p-3">
		<div class="btn-group" role="group" style="z-index: 300;">
			<button type="button" class="btn px-2" onclick={() => matches.show()}>
				<i class="material-icons"> format_list_numbered </i>
			</button>
			<button type="button" class="btn px-2" onclick={() => settings.show()}>
				<i class="material-icons"> settings </i>
			</button>
		</div>
		<div class="btn-group" role="group" style="z-index: 300;">
            <button type="button" class="btn btn-primary" onclick={() => upload.show()}>
                Upload
            </button>
			{#if page === 'app'}
				<button type="button" class="btn btn-primary px-2" onclick={() => (page = 'post')}>
					Post
				</button>
			{:else if page === 'post'}
				<button type="button" class="btn btn-primary px-2" onclick={() => (page = 'app')}>
					App
				</button>
			{/if}
		</div>
	</div>

	<div bind:this={target} style="height: 100vh; display: {page === 'app' ? 'block' : 'none'};">
		<h3>Loading...</h3>
	</div>

	<div style="display: {page === 'post' ? 'block' : 'none'};">
		<Comments {app} />
	</div>
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
		<label for="prescouting">Prescouting</label>
		<input
			class="form-check"
			type="checkbox"
			name="prescouting"
			id="prescouting"
			bind:checked={globalData.prescouting}
		/>
		<label for="practice">Practice</label>
		<input
			class="form-check"
			type="checkbox"
			name="practice"
			id="practice"
			bind:checked={globalData.practice}
		/>
		<!-- TODO: Flip x and y -->
	{/snippet}
	{#snippet buttons()}{/snippet}
</Modal>

<Modal 
	bind:this={upload} 
	title="Upload" 
	size="md"
>
	{#snippet body()}
		<!-- <form action="/api/upload" method="post" enctype="multipart/form-data">
			<input type="file" name="file" />
			<button type="submit">Upload</button>
		</form> -->
	{/snippet}
	{#snippet buttons()}{/snippet}
</Modal>