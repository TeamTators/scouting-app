import terminal from '$lib/server/utils/terminal.js';
import { SupaStruct } from '$lib/services/supabase/supastruct.svelte';
import { fail } from '@sveltejs/kit';

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
	const account = await event.locals.session.getUser();
	if (account.isErr()) {
		terminal.error('Error retrieving account:', account.error);
		return {
			message: 'Account retrieval error',
			error: true,
			success: false,
			account: null
		};
	}

	if (!account.value) {
		terminal.error('No account found in session');
		return {
			message: 'No account found',
			error: false,
			success: false,
			account: null
		};
	}

	const struct = SupaStruct.get({
		client: event.locals.supabase,
		schema: 'core',
		table: 'profile'
	});

	const profileResult = await struct.fromId(account.value.id);
	if (profileResult.isErr()) {
		throw fail(500, {
			message: 'Error retrieving profile',
			error: true,
			success: false,
			account: null
		});
	}

	return {
		message: 'Account retrieved successfully',
		error: false,
		success: true,
		account: profileResult.value.raw
	};
};
