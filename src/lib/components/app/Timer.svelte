<script lang="ts">
	import { TOTAL_TICKS } from '$lib/model/app/new/app';
	import { globalData } from '$lib/model/app/new/global-data.svelte';
	import { Timer } from '$lib/model/app/new/timer';
	import { confirm } from '$lib/utils/prompts';

	const minuteSecond = (seconds: number) => {
		if (seconds === -1) return '0:00';
		const m = String(Math.floor(seconds / 60));
		const s = String(seconds % 60).padStart(2, '0');
		return `${m}:${s}`;
	};

	interface Props {
		timer: Timer;
	}

	const { timer }: Props = $props();
	const running = timer.app.running;

	const matchData = $derived(timer.app.matchData);
</script>

<div
	class="card"
	class:a={globalData.prescouting && !globalData.practice}
	class:b={globalData.practice && !globalData.prescouting}
	class:c={globalData.prescouting && globalData.practice}
>
	<div class="card-body p-3">
		<div class="grid-container">
			<p class="mb-1">
				{$matchData.eventKey}
				{$matchData.compLevel}{$matchData.match} | {$matchData.team}
				{minuteSecond($timer.second)}
			</p>
			<div
				class="progress"
				role="progressbar"
				aria-label="Progress Bar"
				aria-valuenow={$timer.index}
				aria-valuemin="0"
				aria-valuemax={TOTAL_TICKS}
			>
				<div
					class="progress-bar"
					style="width: {($timer.index / TOTAL_TICKS) * 100}%;"
					class:bg-success={$timer.section === 'auto'}
					class:bg-primary={$timer.section === 'teleop'}
					class:bg-warning={$timer.section === 'endgame'}
					class:bg-danger={$timer.section === 'end'}
				></div>
			</div>
			<div role="group" class="button-group">
				<button
					type="button"
					class="btn btn-sm"
					class:btn-outline-success={$timer.section !== 'auto'}
					class:btn-success={$timer.section === 'auto'}
					onclick={() => timer.app.goto('auto')}>Auto</button
				>
				<button
					type="button"
					class="btn btn-sm"
					class:btn-outline-primary={$timer.section !== 'teleop'}
					class:btn-primary={$timer.section === 'teleop'}
					onclick={() => timer.app.goto('teleop')}>Tele</button
				>
				<button
					type="button"
					class="btn btn-sm"
					class:btn-outline-warning={$timer.section !== 'endgame'}
					class:btn-warning={$timer.section === 'endgame'}
					onclick={() => timer.app.goto('endgame')}>Endgame</button
				>
				<button
					type="button"
					class="btn btn-sm"
					class:btn-outline-danger={$timer.section !== 'end'}
					class:btn-danger={$timer.section === 'end'}
					onclick={() => timer.app.goto('end')}>End</button
				>
			</div>
			<div role="group" class="button-group">
				{#if $running} 
					<button type="button" class="btn btn-warning btn-sm" onclick={() => timer.app.pause()}
							style="width: 50%"
						>
						<i class="material-icons">pause</i>
					</button>
				{:else}
					<button type="button" class="btn btn-success btn-sm" onclick={() => timer.app.resume()}
						style="width: 50%"
						>
						<i class="material-icons">play_arrow</i>
					</button>
				{/if}
				<button 
					type="button" 
					class="btn btn-sm btn-danger" 
					onclick={() => {
						confirm('Are you sure you want to reset the app?').then((res) => {
							if (!res) return;
							timer.app.stop();
							timer.app.reset();
						});
					}}
					style="width: 50%"
					>
						<i class="material-icons">
							restart_alt
						</i>
					</button>
			</div>
		</div>
	</div>
</div>

<style>
	.card {
		position: absolute;
		top: 0px;
		left: 50%;
		transform: translate(-50%);
	}

	.grid-container {
		display: grid;
		gap: 8px; /* Adjust spacing between rows */
		grid-template-rows: auto auto auto; /* Three rows */
	}

	.button-group {
		display: flex;
		flex-wrap: wrap; /* Wrap buttons if needed */
	}

	.a {
		background-color: var(--bg-secondary) !important;
	}

	.b {
		background-color: var(--bg-info) !important;
	}

	.c {
		background-color: var(--bg-light) !important;
	}
</style>
