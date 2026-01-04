<script lang="ts">
	import { onMount } from 'svelte';
	import type { TBAEvent } from 'tatorscout/tba';
	import { AppData } from '$lib/model/app/data-pull';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	let events: TBAEvent[] = $state([]);
	let eventKey = $state('');

	onMount(() => {
		AppData.getEvents(Number(page.params.year)).then((res) => {
			if (res.isErr()) return console.error(res.error);
			events = res.value;
		});
	});

	const openEvent = (eventKey: string) => {
		goto(`/app/event/${eventKey}`);
	};
</script>

<div class="container">
	<div class="row">
		<input
			type="text"
			class="form-control"
			onkeydown={(e) => {
				if (e.key === 'Enter') {
					openEvent(eventKey);
				}
			}}
			bind:value={eventKey}
			placeholder="Event Key"
		/>
		<button class="btn btn-primary" onclick={() => openEvent(eventKey)}
			>Goto: /app/event/{eventKey || '[Enter Event Key]'}</button
		>
	</div>
	<hr />
	{#each events as event}
		<div class="row mb-3">
			<a href="/app/event/{event.key}" class="text-reset text-decoration-none">
				<div class="card bg-secondary">
					<div class="card-body">
						{event.name}
					</div>
				</div>
			</a>
		</div>
	{/each}
</div>
