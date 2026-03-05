<!--
@component
Account public profile page for `/account/[username]`.

Renders public-facing account details and related UI for the specified username.
Designed as a top-level page route and does not export component props.
-->
<script lang="ts">
	import Profile from '$lib/components/account/Profile.svelte';
	import supabase from '$lib/services/supabase';
	import { SupaStruct } from '$lib/services/supabase/supastruct';

	const { data } = $props();
	const account = $derived(data.account);
	const struct = SupaStruct.get({
		name: 'profile',
		client: supabase
	});
	const profile = $derived(struct.Generator(account));
</script>

<div class="container layer-1">
	<div class="row mb-3">
		<h1>{account.username}'s Profile</h1>
	</div>
	<div class="row mb-3">
		<Profile {profile} />
	</div>
</div>
