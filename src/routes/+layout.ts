/**
 * @fileoverview Root layout module setup for all routes.
 */
import { isBrowser, createServerClient } from '@supabase/ssr';
import browserClient from '$lib/services/supabase';
import { SupaStruct } from '$lib/services/supabase/supastruct.svelte';

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

	notifications.sync(1000 * 60);

	return {
		supabase,
		session,
		is_mentor: event.data.is_mentor,
		is_student: event.data.is_student,
		is_viewer: event.data.is_viewer,
		profile: event.data.profile ? Profile.Generator(event.data.profile) : null,
		notifications
	};
};
