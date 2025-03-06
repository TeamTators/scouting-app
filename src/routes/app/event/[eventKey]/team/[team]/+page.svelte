<script lang="ts">
	import { goto } from '$app/navigation';
	import { AppData } from '$lib/model/app/data-pull';
	import { onMount } from 'svelte';
	import type { TBAMatch } from 'tatorscout/tba';

	const { data } = $props();
	const eventKey = $derived(data.eventKey);
	const team = $derived(parseInt(data.team));

	let matches: TBAMatch[] = $state([]);
	let match = $state('');

	onMount(() => {
		AppData.getEvent(eventKey).then((res) => {
			if (res.isErr()) return console.error(res.error);
			matches = res.value.matches.filter(
				(m) =>
					m.alliances.red.team_keys.includes(`frc${team}`) ||
					m.alliances.blue.team_keys.includes(`frc${team}`)
			);
		});
	});

	const gotoMatch = (match: string) => {
		// get number from match
		const number = parseInt(match.replace(/\D/g, ''));
		// get comp level from match
		const compLevel = match.replace(/\d/g, '');
		goto(`/app/event/${eventKey}/team/${team}/match/${compLevel}/${number}`);
	};
</script>

<div class="container p-3">
	<div class="row mb-3">
		<h2>Team: {team}</h2>
	</div>
	<div class="row">
		<div class="input-group mb-3">
			<input
				type="text"
				class="form-control"
				bind:value={match}
				placeholder="Enter match like: qm46"
				oninput={(event) => {
					event.currentTarget.value = event.currentTarget.value.toLowerCase().replace(/ /g, '');
				}}
				onkeydown={(e) => {
					if (e.key === 'Enter') {
						gotoMatch(match);
					}
				}}
			/>
			<button type="button" class="btn btn-primary" onclick={() => gotoMatch(match)}>
				Go to Match
			</button>
		</div>
	</div>
	<hr>
	<div class="row">
		<div class="grid">
			{#each matches as match}
				<a
					href="/app/event/{eventKey}/team/{team}/match/{match.comp_level}/{match.comp_level ===
					'sf'
						? match.set_number
						: match.match_number}"
					class="grid-item btn btn-secondary"
				>
					{match.comp_level}
					{match.comp_level === 'sf' ? match.set_number : match.match_number}
				</a>
			{/each}
		</div>
	</div>
</div>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
		gap: 10px;
	}

	.grid-item {
		padding: 10px;
		text-align: center;
	}
</style>
