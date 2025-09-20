<script lang="ts">
	import { App } from '$lib/model/app/app';
	import { confirm } from '$lib/utils/prompts';
	import { onMount } from 'svelte';

	interface Props {
		app: App;
		page: 'app' | 'post';
	}

	let { app = $bindable(), page }: Props = $props();

	export const start = () => {
		return app.start();
	};

	export const stop = () => {
		return app.stop();
	};

	let target: HTMLDivElement;
	onMount(() => {
		const currentState = App.pullState();
		if (currentState.isOk() && currentState.value) {
			if (currentState.value.data) {
				const data = currentState.value.data;
				confirm('You have a previous match in progress, would you like to restore it?')
					.then((res) => {
						if (res) App.deserialize(data, app, target);
						else app.init(target);
					})
					.catch(() => {
						app.init(target);
					});
			}
		} else {
			app.init(target);
		}

		app.animate();
		app.clickPoints(3);
		Object.assign(window, { app });
	});
</script>

<div bind:this={target} style="height: 100vh; display: {page === 'app' ? 'block' : 'none'};">
	<h3>Loading...</h3>
</div>
