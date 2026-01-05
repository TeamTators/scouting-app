<script lang="ts">
	import { App } from '$lib/model/app/app';
	import { SummaryView } from '$lib/model/app/view';
	// import rangeSlider from 'range-slider-input';
	let target: HTMLDivElement;

	let summary: SummaryView | undefined;

	export const render = (app: App) => {
		if (summary) {
			summary.destroy();

			target.parentElement?.querySelector('.slider-container')?.remove();
		}

		const slider = document.createElement('div');
		slider.className = 'slider-container my-2';
		target.parentElement?.append(slider);

		summary = new SummaryView(app, target);
		summary.render(0, summary.trace.length - 1);

		// const s = rangeSlider(slider, {
		// 	min: 0,
		// 	max: summary.trace.length - 1,
		// 	value: [0, summary.trace.length - 1],
		// 	step: 1,
		// 	onInput: (values) => {
		// 		obj.segment(values[0], values[1]);
		// 	}
		// });

		// obj.onreset((from, to) => {
		// 	s.value([from, to]);
		// });
	};
</script>

<div class="card">
	<div class="card-body py-3 px-1">
		<p class="text-muted">
			This is a summary of the match data collected, please take the time to review it. You can
			adjust positions, add/remove/change actions here if there are any mistakes. Changes made here
			will be reflected in the robot's data.
			<br />
			<span class="text-danger">
				Do not spend too much time here, you have a match coming up!
			</span>
		</p>
		<div bind:this={target}></div>
	</div>
</div>
