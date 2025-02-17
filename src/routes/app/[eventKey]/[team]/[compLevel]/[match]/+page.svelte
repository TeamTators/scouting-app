<script lang="ts">
    const { data } = $props();
    const event = $derived(data.event);
    const match = $derived(data.match);
    const team = $derived(data.team);
    const alliance = $derived(data.alliance);
    const exists = $derived(data.exists);
</script>