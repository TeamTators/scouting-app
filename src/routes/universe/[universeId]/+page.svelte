<script lang="ts">
	import { Account } from '$lib/model/account.js';

	const { data } = $props();
	const universe = data.universe;

	const self = Account.getSelf();
</script>

{#if universe}{:else}
	<p>Universe not found</p>
{/if}
