<script lang="ts">
	import { goto } from '$app/navigation';
	import { AppData } from '$lib/model/app/data-pull.js';
	import { onMount } from 'svelte';
	import { teamsFromMatch, type TBAMatch, type TBATeam } from 'tatorscout/tba';

	const { data } = $props();
	const eventKey = $derived(data.eventKey);
	const compLevel = $derived(data.compLevel);
	const match = $derived(parseInt(data.match));

	let matchData: TBAMatch | null = $state(null);
	let teams: TBATeam[] = $state([]);
	let team = $state('');

	onMount(() => {
		AppData.getEvent(eventKey).then((res) => {
			if (res.isErr()) return console.error(res.error);
			matchData =
				res.value.matches.find((m) => m.comp_level === compLevel && m.match_number === match) ??
				null;
			if (matchData) {
				const fromMatch = teamsFromMatch(matchData);
				teams = res.value.teams.filter((t) => fromMatch.includes(t.team_number));
			}
		});
	});

	const gotoTeam = (team: number) => {
		if (Number.isNaN(team)) return;
		goto(`/app/event/${eventKey}/team/${team}/match/${compLevel}/${match}`);
	};
</script>

<div class="container p-3">
	<div class="row mb-3">
		<h2>Match: {compLevel}{match}</h2>
	</div>
	<div class="row">
		<div class="container-fluid">
			<div class="row">
				<div class="input-group mb-3">
					<input
						type="number"
						class="form-control"
						bind:value={team}
						placeholder="Enter team number"
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								gotoTeam(parseInt(team));
							}
						}}
					/>
					<button type="button" class="btn btn-primary" onclick={() => gotoTeam(parseInt(team))}>
						Go to Team
					</button>
				</div>
			</div>
		</div>
	</div>
	<hr>
	<div class="row">
		<div class="grid">
			{#each teams as team}
				<a
					href="/app/event/{eventKey}/team/{team.team_number}/match/{matchData?.comp_level ||
						'pr'}/{matchData?.match_number || 0}"
					class="grid-item btn btn-secondary"
				>
					{team.team_number}
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
