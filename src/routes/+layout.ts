/**
 * @fileoverview Root layout module setup for all routes.
 */
import { isBrowser, createServerClient, createBrowserClient } from '@supabase/ssr';
import { SupaStruct } from '$lib/services/supabase/supastruct.svelte';
import { type Database } from '$lib/types/supabase';

export const load = async (event) => {
	event.depends('supabase:auth');
	const supabase = isBrowser()
		? Object.assign(
				createBrowserClient<Database>(
					event.data.env.supabase.url,
					event.data.env.supabase.public_key,
					{
						global: {
							fetch: event.fetch
						},
						auth: {
							persistSession: true,
							autoRefreshToken: true,
							detectSessionInUrl: false,
							skipAutoInitialize: true
						}
					}
				),
				{
					serviceRole: false
				}
			)
		: Object.assign(
				createServerClient<Database>(
					event.data.env.supabase.url,
					event.data.env.supabase.public_key,
					{
						global: {
							fetch: event.fetch
						},
						cookies: {
							getAll: () => event.data.cookies || [],
							setAll: () => {
								console.error(
									'Attempted to set cookies on the +layout.ts from the server, which is not supported.'
								);
							}
						},
						auth: {
							persistSession: true,
							autoRefreshToken: true,
							detectSessionInUrl: false,
							skipAutoInitialize: true
						}
					}
				),
				{
					serviceRole: false
				}
			);

	const session = isBrowser()
		? (await supabase.auth.getSession()).data.session
		: null;

	const Profile = SupaStruct.get({
		client: supabase,
		schema: 'core',
		table: 'profile'
	});

	const Notifications = SupaStruct.get({
		client: supabase,
		schema: 'core',
		table: 'account_notification'
	});

	const notifications = Notifications.get({
		account_id: String(event.data.profile?.id)
	});

	return {
		supabase,
		session,
		profile: event.data.profile ? Profile.Generator(event.data.profile) : null,
		notifications,
		env: event.data.env,
	};
};
