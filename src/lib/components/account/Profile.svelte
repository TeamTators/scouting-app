<!--
@component
Profile display shell for an account.

**Props**
- `account`: `Account.AccountData` — Account data to display.

**Example**
```svelte
<Profile {account} />
```
-->
<script lang="ts">
	import type { SupaStructData } from '$lib/services/supabase/supastruct';

	interface Props {
		profile: SupaStructData<'profile'>;
	}

	const { profile: _profile }: Props = $props();
</script>

<!-- <img src={$account.picture} alt="{$account.username}'s Profile Picture" srcset="" /> -->
