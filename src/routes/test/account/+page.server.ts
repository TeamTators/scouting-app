import terminal from '$lib/server/utils/terminal.js';
import { SupaStruct } from '$lib/services/supabase/supastruct.svelte';
// import { fail } from '@sveltejs/kit';
import supabase from '$lib/server/services/supabase';

/**
 * @fileoverview Server load for `/test/account`.
 */
export const load = async (event) => {
	if (!event.locals.session)
		return {
			message: 'No session found',
			error: false,
			success: false,
			account: null
		};

	const parent = await event.parent();

	const ProfileStruct = SupaStruct.get({
		client: supabase,
		schema: 'core',
		table: 'profile'
	});

	if (!parent.user) {
		return {
			message: 'No user found in session',
			error: false,
			success: false,
			account: null
		};
	}

	const profileRes = await ProfileStruct.fromId(parent.user.id);

	if (profileRes.isErr()) {
		terminal.error('Error fetching profile:', profileRes.error);
		return {
			message: 'Error fetching profile',
			error: true,
			success: false,
			account: null
		};
	}

	if (!profileRes.value) {
		return {
			message: 'No profile found for user',
			error: false,
			success: false,
			account: null
		};
	}

	return {
		message: 'Profile retrieved successfully',
		error: false,
		success: true,
		account: profileRes.value.raw
	};
};
