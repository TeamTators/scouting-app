<script lang="ts">
	import { onMount } from "svelte";
    import { App } from "../../model/app/app";

    interface Props {
        app: App;
    }

    const { app }: Props = $props();
    const matchData = $derived(app.matchData);

    let alliance = $state('text-warning');
    let teamName = $state('unknown');

    const getTeam = (
    ) => {
        return app.matchData.getEvent().then(e => {
            if (e.isErr()) return;
            const team = e.value.teams.find(t => t.team_number === $matchData.team);
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
        });
    });
</script>


<div style="
    position: absolute; 
    top: 50%; 
    left: 50%; 
    transform: translate(-50%, -50%); 
    color: white; 
    font-size: 2em;
">
    Start tracing to start match <span class="{alliance}">{$matchData.compLevel}{$matchData.match}</span> for team <span class="{alliance}">{$matchData.team}</span> <span class="{alliance}">{teamName}</span>
</div>	