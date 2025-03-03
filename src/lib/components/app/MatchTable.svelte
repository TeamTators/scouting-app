<script lang="ts">
	import { goto } from '$app/navigation';
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
		return matchData.subscribe(() => {
			app.matchData.getEvent().then((data) => {
				if (data.isErr()) return console.error(data.error);
				eventData = data.value;
			});
			app.matchData.getScoutGroups().then(async (data) => {
				if (data.isErr()) return console.error(data.error);
				const scoutGroup = await app.matchData.getScoutGroup();
				if (scoutGroup.isErr()) return console.error(scoutGroup.error);
				if (typeof scoutGroup.value !== 'number') return (assignments = []);
				assignments = data.value.matchAssignments[scoutGroup.value];
			});
		});
	});

	const team = (t: string) => parseInt(t.slice(3));
</script>

{#snippet getTeam(match: TBAMatch, alliance: 'red' | 'blue', position: 1 | 2 | 3, index: number)}
	<td class:bg-primary={alliance === 'blue'} class:bg-danger={alliance === 'red'} class="text-dark">
		<a
			href="/app/event/{match.event_key}/team/{team(
				match.alliances[alliance].team_keys[position - 1]
			)}/match/{match.comp_level}/{match.match_number}"
			class="ws-nowrap mb-2 text-decoration-none mb-2"
			class:fw-bold={match.match_number === $matchData.match &&
				match.comp_level === $matchData.compLevel &&
				team(match.alliances[alliance].team_keys[position - 1]) === $matchData.team}
			class:text-light={assignments[index] ===
				team(match.alliances[alliance].team_keys[position - 1])}
			class:text-dark={assignments[index] !==
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
	<div class="container-fluid">
		<div class="row mb-3">
			<div class="btn-group" role="group">
				<button type="button" class="btn btn-primary" onclick={async () => {
					const data = await matchData.prev();
					if (data.isErr()) return console.error(data.error);

					goto(`/app/event/${data.value.eventKey}/team/${data.value.team}/match/${data.value.compLevel}/${data.value.match}`);
				}}>
					<i class="material-icons">
						arrow_left
					</i>
					Prev
				</button>
				<button type="button" class="btn btn-success" onclick={async () => {
					const data = await matchData.next();
					if (data.isErr()) return console.error(data.error);

					goto(`/app/event/${data.value.eventKey}/team/${data.value.team}/match/${data.value.compLevel}/${data.value.match}`);
				}}>
					Next
					<i class="material-icons">
						arrow_right
					</i>
				</button>
			</div>
		</div>
		<div class="row">
			<div class="table-responsive">
				<table class="table table-striped">
					<thead>
						<tr>
							<td class="ws-nowrap"> Match </td>
							<td class="ws-nowrap"> Time </td>
							<td class="ws-nowrap"> Red 1 </td>
							<td class="ws-nowrap"> Red 2 </td>
							<td class="ws-nowrap"> Red 3 </td>
							<td class="ws-nowrap"> Blue 1 </td>
							<td class="ws-nowrap"> Blue 2 </td>
							<td class="ws-nowrap"> Blue 3 </td>
						</tr>
					</thead>
					<tbody>
						{#each eventData.matches as match, i}
							<tr
								class:highlight={match.comp_level === $matchData.compLevel &&
									match.match_number === $matchData.match}
							>
								<td>
									<p class="ws-nowrap mb-2"
										style="color: var(--match) !important;"
									>
										{match.comp_level}
										{match.match_number}
									</p>
								</td>
								<td>
									<p class="ws-nowrap mb-2"
										style="color: var(--match) !important;">
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
		</div>
	</div>

{:else}
	<p>Loading...</p>
{/if}

<style>
	.highlight {
		--match: var(--bg-info);
    }
</style>
