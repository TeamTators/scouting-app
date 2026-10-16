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
export const refresh_supabase_session = async (client: Pick<SupabaseClient<Database>, 'auth'>) => {
	// Follow Supabase SSR guidance by centralizing auth refresh behavior in one place,
	// so callers do not duplicate refresh-triggering methods across a single request.
	const session_response = await client.auth.getSession();
	if (session_response.error) {
		return { user: null, error: session_response.error };
	}
	if (!session_response.data.session) {
		return { user: null, error: null };
	}

	const is_missing_auth_session_error = (error: unknown) => {
		if (!error || typeof error !== 'object' || !('message' in error)) return false;
		const message = (error as { message?: unknown }).message;
		if (typeof message !== 'string') return false;
		return message.toLowerCase().includes('session missing');
	};

	let user_response = await client.auth.getUser();
	if (user_response.error && is_missing_auth_session_error(user_response.error)) {
		const refresh_response = await client.auth.refreshSession();
		if (refresh_response.error) {
			return { user: null, error: refresh_response.error };
		}
		user_response = await client.auth.getUser();
	}

	if (!user_response.data) {
		return { user: null, error: user_response.error ?? new Error('No user data') };
	}
	return { user: user_response.data.user, error: null };
};
