<script lang="ts">
	import { browser } from '$app/environment';
	import { App } from '$lib/model/app/new/app.js';
	import type { CompLevel } from 'tatorscout/tba';

    const { data } = $props();
    const eventKey = $derived(data.eventKey);
    const match = $derived(parseInt(data.match));
    const team = $derived(parseInt(data.team));
    const compLevel = $derived(data.compLevel) as CompLevel;
    const year = $derived(data.year);
    // const alliance = $derived(data.alliance);
    // const exists = $derived(data.exists);

    let app: App;

    $effect(() => {
        if (!target || browser) return;
        app = new App({
            year,
            eventKey,
            match,
            team,
            compLevel,
            target,
        });
    });

    let target: HTMLDivElement;
</script>

<div class="container-fluid">
    <div class="row">
        <div class="col-12">
            <div bind:this={target}>
                <h3>Loading...</h3>
            </div>
        </div>
    </div>
</div>