<script lang="ts">
	import Navbar from '$lib/components/general/Navbar.svelte';

	const { children } = $props();
</script>

<main class="dashboard">
	<Navbar title="Scouting App" />

	{@render children()}
</main>
