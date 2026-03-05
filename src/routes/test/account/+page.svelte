<!--
@component
Test account page at `/test/account`.
-->
<script lang="ts">
	const { data } = $props();

	const account = $derived(data.account);
	const success = $derived(data.success);
	const error = $derived(data.error);
	const message = $derived(data.message);
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
