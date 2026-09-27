import terminal from '$lib/server/utils/terminal.js';
import { error, redirect } from '@sveltejs/kit';
import { SupaStruct } from '$lib/services/supabase/supastruct.svelte';
import env from '$lib/server/utils/env';
import { refresh_supabase_session } from '$lib/server/utils/supabase-session';

export const load = async (event) => {
	const { user: userData, error: userError } = await refresh_supabase_session(
		event.locals.supabase
	);
	const env_data = {
		environment: env.ENVIRONMENT,
		name: env.APP_NAME,
		supabase: {
			url: env.SB_PUBLIC_URL,
			public_key: env.SB_PUBLIC_KEY,
			s3_access_key: env.SB_STORAGE_ACCESS_KEY
		},
	};

	if (userError) {
		terminal.error('Error getting user from session:', userError);
		return {
			user: null,
			cookies: event.cookies.getAll(),
			is_mentor: false,
			is_student: false,
			is_viewer: false,
			env: env_data
		};
	}

	if (!userData) {
		throw redirect(303, '/account/sign-in');
	}

	const ProfileStruct = SupaStruct.get({
		client: event.locals.supabase,
		schema: 'core',
		table: 'profile'
	});

	const [profile] = await Promise.all([
		ProfileStruct.get({ id: userData.id }).first(),
	]);


	if (profile.isErr()) {
		terminal.error('Error getting profile:', profile.error);
		throw error(500, 'Internal Server Error');
	}
	return {
		user: userData || null,
		cookies: event.cookies.getAll(),
		profile: profile.value?.raw || null,
		env: env_data
	};
};
