<!--
@component
Dashboard layout for `/dashboard` routes. Acts as middleware for dashboard pages.

Wraps all dashboard views with shared navigation and styling expectations. This
layout isolates dashboard-specific UI from the public site layout.
-->
<script lang="ts">
	const { children } = $props();
</script>

<main class="dashboard">
	{@render children()}
</main>
