<!--
@component
Root layout wrapper for all routes. Acts as middleware for global bootstrapping.
-->
<script>
	import '$lib/index';
	const { children } = $props();
</script>

<main>
	{@render children()}
</main>
