<script lang="ts">
	import Navbar from '$lib/components/general/Navbar.svelte';

	const { children } = $props();
</script>

<main class="dashboard">
	<Navbar title="Demo Dashboard" />

	{@render children()}
</main>
