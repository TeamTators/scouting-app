<!--
@component
Root layout wrapper for all routes. Acts as middleware for global bootstrapping.
-->
<script>
	import { Struct } from '$lib/services/struct';
	import { browser } from '$app/environment';
	import '$lib/index';
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
		/* user-drag: none; */
		-webkit-user-drag: none;
		user-select: none;
		-webkit-user-select: none;
	}
</style>
