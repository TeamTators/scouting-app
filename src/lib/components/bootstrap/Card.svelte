<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		color?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'light' | 'dark';
		body: Snippet;
		classes?: string;
		glowColor?:
			| 'primary'
			| 'secondary'
			| 'success'
			| 'danger'
			| 'warning'
			| 'info'
			| 'light'
			| 'dark';
	}

	const { title, body, color, classes = '', glowColor }: Props = $props();

	const glowColorProxy = glowColor ? `glow glow-${glowColor}` : 'shadow';
	const colorProxy = color ? `bg-${color}` : '';

	let minimized = $state(false);
	let hidden = $state(false);

	export const minimize = () => (minimized = true);

	export const maximize = () => (minimized = false);

	export const hide = () => (hidden = true);

	export const show = () => (hidden = false);
</script>

<div class="card toggle-hide {classes} {colorProxy} {glowColorProxy}" class:hide={hidden}>
	<div class="card-header">
		<h5 class="card-title">
			{title}
		</h5>
	</div>
	<div class="card-body toggle-hide" class:hide={minimized}>
		{@render body()}
	</div>
</div>

<style>
	.hide {
		display: none;
	}

	.toggle-hide {
		transition: all 0.5s;
	}
</style>
