<script>
	import { Struct } from 'drizzle-struct/front-end';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';

	setTimeout(() => {
		if (browser) Struct.buildAll();
	});
	const { children } = $props();

	onMount(() => {
		document.addEventListener('dragstart', (e) => e.preventDefault());
	});
</script>

<main>
	{@render children()}
</main>

<style>
	* {
		user-drag: none;
		-webkit-user-drag: none;
		user-select: none;
		-webkit-user-select: none;
	}
</style>
