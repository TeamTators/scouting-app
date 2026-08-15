<script lang="ts">
    import Grid from '$lib/components/general/Grid.svelte';
    const { data } = $props();

    const Test = $derived(data.Test);
    const all = $derived(data.query.reactive);
</script>

<button class="btn btn-primary" type="button" onclick={async () => {
    Test.new({
        name: `Test ${Math.random()}`,
        age: Math.round(Math.random() * 100)
    })
}}>
    New
</button>
<Grid 
    data={all}
    opts={{
        columnDefs: [
            {
                field: 'raw.name',
                headerName: 'Name'
            },
            {
                field: 'raw.age',
                headerName: 'Age',
            }
        ]
    }}
    height="400px"
/>