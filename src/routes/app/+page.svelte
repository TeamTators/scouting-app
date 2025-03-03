<script lang="ts">
	import { onMount } from 'svelte';
	import type { TBAEvent } from 'tatorscout/tba';
	import { AppData } from '$lib/model/app/data-pull';
	import { goto } from '$app/navigation';

	let events: TBAEvent[] = $state([]);
	let eventKey = $state('');

	onMount(() => {
		AppData.getEvents(new Date().getFullYear()).then((res) => {
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
	{#each events as event}
		<div class="row">
			<a href="/app/event/{event.key}">
				<div class="card">
					<div class="card-body">
						{event.name}
					</div>
				</div>
			</a>
		</div>
	{/each}
</div>
