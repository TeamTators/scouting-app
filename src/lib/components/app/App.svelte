<script lang="ts">
	import { App } from '$lib/model/app/app';
	import { onMount } from 'svelte';

	interface Props {
		app: App;
		page: 'app' | 'post';
	}

	const { app, page }: Props = $props();

	export const start = () => {
		return app.start();
	};

	export const stop = () => {
		return app.stop();
	};

	let target: HTMLDivElement;
	onMount(() => {
		app.init(target);
		app.animate();
		app.clickPoints(3);
		Object.assign(window, { app });
	});
</script>

<div bind:this={target} style="height: 100vh; display: {page === 'app' ? 'block' : 'none'};">
	<h3>Loading...</h3>
</div>
