<script lang="ts">
    const { data } = $props();
    const eventKey = $derived(data.eventKey);
    const match = $derived(data.match);
    const team = $derived(data.team);
    const compLevel = $derived(data.compLevel);
    // const alliance = $derived(data.alliance);
    // const exists = $derived(data.exists);
</script>


<a href="/app/2024idbo/2122/qm/3">Test</a>

{eventKey} {compLevel} {match} {team}