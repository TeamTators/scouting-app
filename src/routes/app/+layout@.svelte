<script lang="ts">
	import { onMount } from 'svelte';

	const { children } = $props();

	onMount(() => {
		// attempted reload
		window.addEventListener('beforeunload', (e) => {
			e.preventDefault();
		});
	});
</script>

{@render children()}
