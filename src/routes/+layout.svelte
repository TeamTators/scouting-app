<!--
@component
Root layout wrapper for all routes. Acts as middleware for global bootstrapping.
-->
<script>
	import '$lib/index';
	const { children, data } = $props();
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';
	import Loading from '$lib/components/general/Loading.svelte';
	import { setup_network_listener } from '$lib/services/supabase/supastruct.svelte';

	onMount(() => {
		const res = data.supabase.auth.onAuthStateChange((event, session) => {
			if (session?.expires_at !== data.session?.expires_at) {
				invalidate('supabase:auth');
			}
		});
		Object.assign(window, { supabase: data.supabase });
		const off_network_listener = setup_network_listener(data.supabase);
		return () => {
			res.data.subscription.unsubscribe();
			off_network_listener();
		};
	});
</script>

<main>
	{@render children()}
	<Loading />
</main>
