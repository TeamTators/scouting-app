<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import type { Snippet } from 'svelte';

	type BootstrapColor =
		'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'light' | 'dark' | 'gray';

	interface Props {
		color: BootstrapColor;
		children: Snippet;
		duration: number;
		oncomplete: () => void | Promise<void>;
		class?: string;
		reset_on_complete?: boolean;
	}

	const {
		color,
		children,
		duration,
		oncomplete,
		class: className,
		reset_on_complete = true
	}: Props = $props();

	const tween = $derived(
		new Tween(0, {
			duration,
			easing: cubicOut
		})
	);

	const complete = $derived(tween.current >= 1);
	let complete_called = $state(false);
	let released = $state(true);
	const run_complete = async () => {
		await oncomplete();
		if (reset_on_complete) {
			tween.set(0);
			setTimeout(() => {
				complete_called = false;
			}, 100);
		}
	};

	$effect(() => {
		if (complete && !complete_called && released) {
			complete_called = true;
			run_complete();
		}
	});

	const down = (event: MouseEvent | TouchEvent) => {
		event.preventDefault();
		tween.set(1);
		released = false;
	};

	const up = (event: MouseEvent | TouchEvent) => {
		event.preventDefault();
		if (!complete) {
			tween.set(0);
		}
		released = true;
	};

	const progressColor = $derived(`var(--bs-${color})`);
</script>

<button
	class="btn position-relative overflow-hidden {className || ''}"
	onmousedown={down}
	onmouseup={up}
	onmouseleave={up}
	ontouchstart={down}
	ontouchend={up}
	ontouchcancel={up}
	style:--progress={`${tween.current * 100}%`}
	style:--progress-color={complete
		? progressColor
		: `color-mix(in srgb, var(--bs-${color}) 50%, var(--bs-dark) 50%)`}
	style:--button-color={`var(--bs-${color})`}
	style:--text-color={complete ? `contrast-color(var(--bs-${color}))` : `var(--bs-${color})`}
>
	<span class="progress"></span>
	<span class="content">
		{@render children()}
	</span>
</button>

<style>
	button {
		position: relative;
		border-color: var(--button-color);
		border-width: 2px;
		border-radius: 8px !important;
		color: var(--text-color);
	}

	button:hover {
		border-color: var(--progress-color) !important;
		color: contrast-color(var(--progress-color)) !important;
	}

	/* When clicking, get rid of white border */
	button:active {
		border-color: var(--button-color);
	}

	.progress {
		position: absolute;
		inset: 0;
		width: var(--progress);
		background: var(--progress-color);
		pointer-events: none;
		height: 100%;
		transition: background 0.2s ease;
	}

	.content {
		position: relative;
		z-index: 1;
	}
</style>
