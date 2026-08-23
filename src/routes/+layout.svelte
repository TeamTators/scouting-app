<!--
@component
Root layout wrapper for all routes. Acts as middleware for global bootstrapping.
-->
<script lang="ts">
	import Footer from '$lib/components/general/Footer.svelte';
	import Navbar from '$lib/components/general/Navbar.svelte';
	import ScrollToTop from '$lib/components/general/ScrollToTop.svelte';
	import '$lib/index';
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';
	import Loading from '$lib/components/general/Loading.svelte';
	import { setup_network_listener, SupaStruct } from '$lib/services/supabase/supastruct.svelte';

	const { children, data } = $props();

	onMount(() => {
		const unsub_notifications = data.notifications.subscribe();
		const res = data.supabase.auth.onAuthStateChange((event, session) => {
			if (session?.expires_at !== data.session?.expires_at) {
				invalidate('supabase:auth');
			}
		});
		Object.assign(window, { supabase: data.supabase, SupaStruct });
		const off_network_listener = setup_network_listener(data.supabase);
		return () => {
			unsub_notifications();
			res.data.subscription.unsubscribe();
			off_network_listener();
		};
	});
</script>

<main>
	<Navbar
		title={__APP_ENV__.name}
		notifications={data.notifications.reactive}
		account={data.profile}
	/>
	{@render children()}
	<ScrollToTop />
	<Loading />
	<Footer />
</main>
