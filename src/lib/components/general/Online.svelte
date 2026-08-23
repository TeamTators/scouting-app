<script lang="ts">
	import { onMount } from 'svelte';
	import { on_network_change, on_network_latency } from '$lib/utils/online.svelte';

	let is_online = $state(true);
	let latency = $state(0);
	let connecting = $derived(latency === 0);

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

<div class="dropdown">
	<button class="btn dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
		<div class="overlay">
			<i class="mi" style="color: var(--bs-gray);"> wifi </i>
			<i
				class="mi"
				title={is_online ? `Online (latency: ${latency.toFixed(2)}ms)` : 'Offline'}
				class:text-gray={connecting}
				class:text-danger={!is_online}
				class:text-warning={is_online && latency > 100}
				class:text-success={is_online && latency <= 100}
			>
				{#if !is_online}
					wifi_off
				{:else if latency > 200}
					wifi_1_bar
				{:else if latency > 100}
					wifi_2_bar
				{:else}
					wifi
				{/if}
			</i>
		</div>
	</button>
	<ul
		class="dropdown-menu animate__animated animate__fadeInDown animate__faster px-5 layer-1 shadow"
		style="
					position: fixed;
					top: 52px;
					left: calc(100% - 240px);
					width:	min-content;
				"
	>
		<div class="popover-header">Network Status</div>
		<div class="popover-body">
			<p class="mb-0 ws-nowrap">
				{#if connecting}
					<span class="text-warning">Connecting...</span>
				{:else if is_online}
					<span class="text-success">Online</span> <br />(latency: {latency.toFixed(2)}ms)
				{:else}
					<span class="text-danger">Offline</span>
				{/if}
			</p>
		</div>
	</ul>
</div>

<div class="banner" class:show={!is_online}>You are offline.</div>

<style>
	.overlay {
		position: relative;
		display: inline-block;
		margin-right: 12px;
	}

	.overlay * {
		position: absolute;
		top: 0;
		right: 0;
		transform: translate(50%, -50%);
	}

	button {
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		display: flex;
	}

	.banner {
		position: fixed;
		bottom: 0;
		left: 0;
		width: 100%;
		height: 40px;
		background-color: var(--bs-danger);
		color: var(--bs-light);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.2rem;
		font-weight: bold;
		z-index: 9999;
		opacity: 0.8;
		transform: translateY(100%);
		transition: transform 0.3s ease-in-out;
	}

	.banner.show {
		transform: translateY(0);
	}
</style>
