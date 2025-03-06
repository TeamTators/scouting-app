<script lang="ts">
	import { goto } from '$app/navigation';
	import { AppData } from '$lib/model/app/data-pull';
	import { onMount } from 'svelte';
	import type { TBAMatch, TBATeam } from 'tatorscout/tba';

	const { data } = $props();
	const eventKey = $derived(data.eventKey);

	let matches: TBAMatch[] = $state([]);
	let teams: TBATeam[] = $state([]);

	let match = $state('');
	let team = $state('');

	onMount(() => {
		AppData.getEvent(eventKey).then(async (res) => {
			if (res.isErr()) return console.error(res.error);
			matches = res.value.matches;
			teams = res.value.teams;
		});
	});

	const parseMatch = (match: string) => {
		if (!match.length) return '[Enter Match]';
		match = match.toLowerCase().replace(/ /g, '');
		let compLevel = match.replace(/\d/g, '');
		let number = parseInt(match.replace(/\D/g, ''));

		if (!compLevel) compLevel = 'pr';
		if (Number.isNaN(number)) number = 0;
		return `${compLevel}/${number}`;
	};

	const gotoMatch = (match: string) => {
		if (!match.length) return;
		goto(`/app/event/${eventKey}/match/${parseMatch(match)}`);
	};

	const gotoTeam = (team: number) => {
		goto(`/app/event/${eventKey}/team/${team}`);
	};
</script>

<div class="container p-3">
	<div class="row mb-3">
		<h2>Event: {eventKey}</h2>
	</div>
	<div class="row">
		<div class="col-md-6">
			<div class="container-fluid">
				<div class="row">
					<div class="input-group mb-3">
						<input
							type="text"
							class="form-control"
							bind:value={match}
							placeholder="Enter match like: qm46"
							oninput={(event) => {
								event.currentTarget.value = event.currentTarget.value
									.toLowerCase()
									.replace(/ /g, '');
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
								href="/app/event/{eventKey}/match/{match.comp_level}/{match.match_number}"
								class="grid-item btn btn-secondary"
							>
								{match.comp_level}
								{match.match_number}
							</a>
						{/each}
					</div>
				</div>
			</div>
		</div>
		<div class="col-md-6">
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
				<hr>
				<div class="row">
					<div class="grid">
						{#each teams as team}
							<a
								href="/app/event/{eventKey}/team/{team.team_number}"
								class="grid-item btn btn-secondary"
							>
								{team.team_number}
							</a>
						{/each}
					</div>
				</div>
			</div>
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
