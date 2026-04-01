<!--
@component
Account search input with debounced query results.

**Props**
- `onselect`: `(account: Account) => void` — Called when an account is chosen.
- `onsearch`?: `(accounts: Account[]) => void` — Called with search results.
- `filter`?: `(account: Account) => boolean` — Optional filter.

**Exports**
- `search(query: string)`: run a debounced search.
- `select(account: Account)`: select an account programmatically.

**Example**
```svelte
<AccountSearch onselect={(account) => console.log(account)} />
```
-->
<script lang="ts">
	import { getAccountFactory } from '$lib/model/account';
	import supabase from '$lib/services/supabase';
	import type { SupaStructData } from '$lib/services/supabase/supastruct-data';
	import { after } from 'ts-utils';

	const factory = getAccountFactory(supabase);

	interface Props {
		onselect: (account: SupaStructData<'profile'>) => void;
		onsearch?: (account: SupaStructData<'profile'>[]) => void;
		filter?: (account: SupaStructData<'profile'>) => boolean;
	}

	const { onselect, onsearch, filter }: Props = $props();

	let query = $state('');

	let timeout: ReturnType<typeof setTimeout>;

	let results = $state(factory.profile.arr());

	export const search = (username: string) => {
		if (timeout) clearTimeout(timeout);
		timeout = setTimeout(() => {
			results = factory.search(
				{
					field: 'username',
					operator: 'ilike',
					value: `%${username}%`
				},
				{
					type: 'all',
					expires: after(5 * 60 * 1000)
				}
			);
			if (filter) results.filter(filter);
			if (onsearch) onsearch(results.data);
		}, 300);
	};

	export const select = (account: SupaStructData<'profile'>) => {
		onselect(account);
		query = '';
	};
</script>

<div class="account-search">
	<input
		type="text"
		class="form-control"
		placeholder="Search accounts..."
		bind:value={query}
		oninput={() => search(query)}
	/>
	{#if query}
		<div class="search-results card mt-1">
			<ul class="list-group list-group-flush">
				{#each $results as account (account.data.id)}
					<li class="list-group-item list-group-item-action">
						<button type="button" class="btn" onclick={() => select(account)}>
							{account.data.username} - {account.data.first_name}
							{account.data.last_name}
						</button>
					</li>
				{/each}
				{#if $results.length === 0}
					<li class="list-group-item text-muted">No results found.</li>
				{/if}
			</ul>
		</div>
	{/if}
</div>
