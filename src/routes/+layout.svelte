<script>
	import { Struct } from '$lib/services/struct';
	import { browser } from '$app/environment';
<<<<<<< HEAD
	import '$lib/index';
=======
	import { onMount } from 'svelte';
>>>>>>> 984257cc6ef87ae0528e26405837ec650c7e5ddc

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
