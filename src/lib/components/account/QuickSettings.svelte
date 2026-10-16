<script lang="ts">
	import type { SupaStructData, Client } from '$lib/services/supabase/supastruct.svelte';

	interface Props {
		account: SupaStructData<'core', 'profile'> | null;
		supabase: Client;
	}

	const { account, supabase }: Props = $props();
</script>

<div class="container"></div>
