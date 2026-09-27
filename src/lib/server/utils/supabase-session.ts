/**
 * @fileoverview Helper for refreshing a Supabase auth session without double-refresh races.
 *
 * This utility follows the project’s guidance to avoid calling the same refresh flow twice on
 * the same request, which can consume a single-use refresh token and produce stale JWT errors.
 *
 * @example
 * import { refresh_supabase_session } from '$lib/server/utils/supabase-session';
 * const { user } = await refresh_supabase_session(supabase);
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/supabase';

/**
 * Calls the Supabase auth refresh flow and returns the current user state.
 *
 * @param {Pick<SupabaseClient<Database>, 'auth'>} client - Supabase client with an `auth` namespace.
 * @returns {{ user: Database['public']['Tables']['users']['Row'] | null; error: unknown } | { user: null; error: Error | null }} Refresh result.
 */
export const refresh_supabase_session = async (
	client: Pick<SupabaseClient<Database>, 'auth'>
) => {
	// Follow Supabase SSR guidance: avoid running getSession()/getUser()/getClaims()
	// from both middleware and route handlers on the same request, because concurrent
	// refreshes can consume the same single-use refresh token and trigger a stale JWT.
	const { data: userData, error: userError } = await client.auth.getUser();
	return { user: userData.user, error: userError };
};
