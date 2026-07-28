<script lang="ts">
	import { onMount } from 'svelte';
	import { on_network_change, on_network_latency } from '$lib/utils/online.svelte.ts';

	let is_online = $state(true);
	let latency = $state(0);

	onMount(() => {
		const unsubscribe = on_network_change((online) => {
			is_online = online;
		});
		const unsubscribe_latency = on_network_latency((lat) => {
			latency = lat;
		});
		is_online = navigator.onLine;

		return () => {
			unsubscribe();
			unsubscribe_latency();
		};
	});
</script>

<i
	class="material-icons"
	title={is_online ? `Online (latency: ${latency.toFixed(2)}ms)` : 'Offline'}
	class:text-danger={!is_online}
	class:text-warning={is_online && latency > 100}
	class:text-success={is_online && latency <= 100}
>
	{#if !is_online}
		wifi_off
	{:else if latency > 500}
		signal_wifi_0_bar
	{:else if latency > 200}
		signal_wifi_1_bar
	{:else if latency > 150}
		signal_wifi_2_bar
	{:else if latency > 100}
		signal_wifi_3_bar
	{:else}
		signal_wifi_4_bar
	{/if}
</i>
