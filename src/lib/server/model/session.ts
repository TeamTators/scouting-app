import { SupaStructData, type Client } from '$lib/services/supabase/supastruct.svelte';

type SupabaseSession =
	ReturnType<Client['auth']['getSession']> extends Promise<infer U> ? U : never;

export class Session {
	constructor(
		public readonly session: SupabaseSession['data']['session'],
		public readonly extended: SupaStructData<'core', 'session'>
	) {}
}
