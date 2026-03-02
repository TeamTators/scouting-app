/**
 * @fileoverview Root layout module setup for all routes.
 */
import '$lib/imports';
import { isBrowser, createServerClient, createBrowserClient } from '@supabase/ssr';

export const load = async (event) => {
	event.depends('supabase:auth');
	const supabase = isBrowser()
		? createBrowserClient(__APP_ENV__.supabase.url, __APP_ENV__.supabase.anon_key, {
				global: {
					fetch: event.fetch
				}
			})
		: createServerClient(__APP_ENV__.supabase.url, __APP_ENV__.supabase.anon_key, {
				global: {
					fetch: event.fetch
				},
				cookies: {
					getAll: () => event.data.cookies || []
				}
			});

	const {
		data: { session },
		error
	} = await supabase.auth.getSession();
	if (error) {
		console.error('Error fetching session:', error);
	}
	return {
		supabase,
		session
	};
};
