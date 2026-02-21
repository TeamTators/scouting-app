<script lang="ts">
	import { App } from '$lib/model/app/app';
	import { SummaryView } from '$lib/model/app/view';
	let target: HTMLDivElement;

	let summary: SummaryView | undefined;

	export const render = (app: App) => {
		if (summary) {
			summary.destroy();
		}

		summary = new SummaryView(app, target);
		summary.render(0, -1);
	};
</script>

<div class="card">
	<div class="card-body py-3 px-1">
		<p class="text-muted">
			This is a summary of the match data collected, please take the time to review it. You can
			adjust positions, add/remove/change actions here if there are any mistakes. Changes made here
			will be reflected in the robot's data.
			<br />
			Focus primarily on the actions if you feel they need to be changed or moved. The non-action positions are less important.
			<br />
			<span class="text-danger">
				Do not spend too much time here, you have a match coming up!
			</span>
		</p>
		<div bind:this={target}></div>
	</div>
</div>
