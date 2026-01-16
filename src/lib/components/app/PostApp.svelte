<script lang="ts">
	import { App } from '$lib/model/app/app';
	import { SummaryView } from '$lib/model/app/view';
	import { RangeSlider } from '$lib/utils/form';
	let target: HTMLDivElement;

	let summary: SummaryView | undefined;

	let unsub = () => {};

	export const render = (app: App) => {
		unsub();
		if (summary) {
			summary.destroy();

			target.parentElement?.querySelector('.slider-container')?.remove();
		}

		const sliderEl = document.createElement('div');
		sliderEl.className = 'slider-container my-2';
		target.parentElement?.append(sliderEl);

		summary = new SummaryView(app, target);
		const opts = summary.render(0, summary.trace.length - 1);

		const slider = new RangeSlider({
			min: 0,
			max: summary.trace.length - 1,
			target: sliderEl,
			step: 1,
		});
		unsub = slider.subscribe(({ min, max }) => {
			opts.view(min, max);
		});

		slider.render();
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
