<script lang="ts">
	import { App, SECTIONS } from '$lib/model/app/app';
	import { SummaryView } from '$lib/model/app/view';
	let target: HTMLDivElement;

	let summary: SummaryView | undefined;

	export const render = (app: App) => {
		if (summary) {
			console.log('Destroying previous summary view');
			summary.destroy();
		}
		summary = new SummaryView(app, target);

		summary.init();
	};

</script>

<div bind:this={target}></div>
