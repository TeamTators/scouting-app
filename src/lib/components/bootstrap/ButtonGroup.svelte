<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		size?: 'sm' | 'md' | 'lg';
		vertical?: boolean;
		label?: string;
		buttons: Snippet;
	}

	const { size = 'sm', vertical = false, label = '', buttons }: Props = $props();
</script>

<div
	class="btn-group btn-group-{size}"
	role="group"
	aria-label={label}
	class:btn-group-vertical={vertical}
>
	{@render buttons()}
</div>
