<!--
@component
Test account page at `/test/account`.
-->
<script lang="ts">
	import { SupaStruct } from '$lib/services/supabase/supastruct.svelte.js';
	import { onMount } from 'svelte';
	const { data } = $props();

	const account = $derived(data.account);
	const success = $derived(data.success);
	const error = $derived(data.error);
	const message = $derived(data.message);

	const Notification = $derived(
		SupaStruct.get({
			client: data.supabase,
			schema: 'core',
			table: 'account_notification'
		})
	);

	const notifs = $derived(Notification.get({ account_id: account?.id }));

	onMount(() => {
		notifs.subscribe();
	});
</script>

{#if account}
	<h1 id="accountInfo" data-success={true}>
		You are signed in as {account.username} (ID: {account.id})
	</h1>
{:else}
	<h1 id="accountInfo" data-success={false}>You are not signed in.</h1>
{/if}
<small>{message}</small>

{#if success}
	<p id="success" data-success={true}>Success: {success}</p>
{/if}
{#if error}
	<p id="error" data-success={false}>Error: {error}</p>
{/if}

{#if account}
	<button
		class="btn btn-primary"
		onclick={() => {
			if (!account) return;
			Notification.new({
				account_id: account.id,
				icon: 'labs',
				icon_type: 'material-icons',
				title: 'Test Notification',
				message: 'This is a test notification.',
				severity: 'danger'
			}).unwrap();
		}}
	>
		Test Notification
	</button>
{/if}

{#each notifs.reactive as notification (notification.raw.id)}
	<div class="notification">
		<p><strong>{notification.raw.title}</strong></p>
		<p>{notification.raw.message}</p>
		<p>Severity: {notification.raw.severity}</p>
	</div>
{/each}

<style>
	.notification {
		border: 1px solid #ccc;
		padding: 1rem;
		margin-bottom: 1rem;
		border-radius: 4px;
	}
</style>
