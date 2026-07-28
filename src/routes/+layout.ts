/**
 * @fileoverview Root layout module setup for all routes.
 */
import { isBrowser, createServerClient } from '@supabase/ssr';
import browserClient from '$lib/services/supabase';

export const load = async (event) => {
	event.depends('supabase:auth');
	const supabase = isBrowser()
		? browserClient
		: Object.assign(
				createServerClient(__APP_ENV__.supabase.url, __APP_ENV__.supabase.public_key, {
					global: {
						fetch: event.fetch
					},
					cookies: {
						getAll: () => event.data.cookies || []
					}
				}),
				{
					serviceRole: false
				}
			);

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
