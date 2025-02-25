<script lang="ts">
	import type { App } from '$lib/model/app/new/app';
	import { onMount } from 'svelte';
	import type { CompLevel, TBAEvent, TBAMatch, TBATeam } from 'tatorscout/tba';
	import { dateString } from 'ts-utils/clock';

	const dateTime = dateString('MM/DD hh:mm AM');

	interface Props {
		app: App;
	}

	const { app }: Props = $props();

	const matchData = app.matchData;

	let assignments: number[] = $state([]);
	let eventData:
		| {
				event: TBAEvent;
				teams: TBATeam[];
				matches: TBAMatch[];
		  }
		| undefined = $state(undefined);

	onMount(() => {
		app.matchData.getEvent().then((data) => {
			if (data.isErr()) return console.error(data.error);
			eventData = data.value;
		});
		app.matchData.getScoutGroups().then(async (data) => {
			if (data.isErr()) return console.error(data.error);
			const scoutGroup = await app.matchData.getScoutGroup();
			if (scoutGroup.isErr()) return console.error(scoutGroup.error);
			if (!scoutGroup.value) return (assignments = []);
			assignments = data.value.matchAssignments[scoutGroup.value];
		});
	});

	const team = (t: string) => parseInt(t.slice(3));
</script>

{#snippet getTeam(match: TBAMatch, alliance: 'red' | 'blue', position: 1 | 2 | 3, index: number)}
	<td class:bg-primary={alliance === 'blue'} class:bg-danger={alliance === 'red'} class="text-dark">
		<a
			href="/app/{match.event_key}/{team(
				match.alliances[alliance].team_keys[position - 1]
			)}/{match.comp_level}/{match.match_number}"
			class="ws-nowrap mb-2 text-reset text-decoration-none mb-2"
			class:fw-bold={match.match_number === $matchData.match &&
				match.comp_level === $matchData.compLevel &&
				team(match.alliances[alliance].team_keys[position - 1]) === $matchData.team}
			class:text-secondary={assignments[index] ===
				team(match.alliances[alliance].team_keys[position - 1])}
			onclick={() => {
				app.matchData.set({
					eventKey: match.event_key,
					team: team(match.alliances[alliance].team_keys[position - 1]),
					compLevel: match.comp_level as CompLevel,
					match: match.match_number
				});
			}}
		>
			{team(match.alliances[alliance].team_keys[position - 1])}
		</a>
	</td>
{/snippet}

{#if eventData}
	<div class="table-responsive">
		<table class="table table-striped">
			<thead>
				<tr>
					<td> Match </td>
					<td> Time </td>
					<td> Red 1 </td>
					<td> Red 2 </td>
					<td> Red 3 </td>
					<td> Blue 1 </td>
					<td> Blue 2 </td>
					<td> Blue 3 </td>
				</tr>
			</thead>
			<tbody>
				{#each eventData.matches as match, i}
					<tr
						class:highlight={match.comp_level === $matchData.compLevel &&
							match.match_number === $matchData.match}
					>
						<td>
							<p class="ws-nowrap mb-2">
								{match.comp_level}
								{match.match_number}
							</p>
						</td>
						<td>
							<p class="ws-nowrap mb-2">
								{match.predicted_time ? dateTime(match.predicted_time * 1000) : 'unknown'}
							</p>
						</td>
						{@render getTeam(match, 'red', 1, i)}
						{@render getTeam(match, 'red', 2, i)}
						{@render getTeam(match, 'red', 3, i)}
						{@render getTeam(match, 'blue', 1, i)}
						{@render getTeam(match, 'blue', 2, i)}
						{@render getTeam(match, 'blue', 3, i)}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{:else}
	<p>Loading...</p>
{/if}

<style>
	/* .highlight {
        background-color: gray !important;
    } */
</style>
