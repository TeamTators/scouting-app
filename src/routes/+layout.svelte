<!--
@component
Root layout wrapper for all routes. Acts as middleware for global bootstrapping.
-->
<script>
	import '$lib/index';
	const { children, data } = $props();
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';

	onMount(() => {
		const res = data.supabase.auth.onAuthStateChange((event, session) => {
			if (session?.expires_at !== data.session?.expires_at) {
				invalidate('supabase:auth');
			}
		});
		return res.data.subscription.unsubscribe();
	});
</script>

<main>
	{@render children()}
</main>
