<script lang="ts">
	import { onMount } from 'svelte';
	import { App } from '../../model/app/app';
	import { globalData } from '$lib/model/app/global-data.svelte';

	interface Props {
		app: App;
	}

	const { app }: Props = $props();
	const matchData = $derived(app.matchData);

	let alliance = $state('text-warning');
	let teamName = $state('unknown');
	let scoutGroup = $state<number | null>(null);

	const getGroup = async () => {
		scoutGroup = await matchData.getScoutGroup().unwrapOr(null);
	};

	const getTeam = () => {
		return app.matchData.getEvent().then((e) => {
			if (e.isErr()) return;
			const team = e.value.teams.find((t) => t.team_number === $matchData.team);
			if (team) {
				teamName = team.nickname || 'unknown';
			}
		});
	};

	onMount(() => {
		return matchData.subscribe((md) => {
			if (md.alliance === 'red') {
				alliance = 'text-danger';
			} else if (md.alliance === 'blue') {
				alliance = 'text-primary';
			} else {
				alliance = 'text-warning';
			}
			getTeam();
			getGroup();
		});
	});
</script>

<div
	style="
    position: absolute; 
    top: 50%; 
    left: 50%; 
    transform: translate(-50%, -50%); 
    color: white; 
"
	class="no-select"
>
	<h3>
		Start tracing to start match
		<span class={alliance}>{$matchData.compLevel}{$matchData.match}</span>
		for team
		<span class={alliance}>{$matchData.team}</span>
		<span class={alliance}>{teamName}</span>
	</h3>
	<h5>
		<small class="text-muted">
			Scout: {globalData.scout ? globalData.scout : '<unknown>'}, Group: {scoutGroup !== null
				? scoutGroup + 1
				: '?'}
		</small>
		<br />
		<small class="text-warning">
			Please make sure your name, group, and match number is correct.
		</small>
		<br />
		<small>
			Change name or group: Click <i class="material-icons">settings</i> in the top left
		</small>
		<br />
		<small>
			Change match: Click <i class="material-icons">list</i> in the top left
		</small>
	</h5>
</div>
