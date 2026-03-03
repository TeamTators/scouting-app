import terminal from '$lib/server/utils/terminal.js';

/**
 * @fileoverview Server load for `/test/account`.
 */
export const load = async (event) => {
	const session = await event.locals.getSession();
	if (session.isErr()) {
		terminal.error('Error retrieving session:', session.error);
		return {
			message: 'Session error',
			error: true,
			success: false,
			account: null,
		}
	}
	if (!session.value) {
		terminal.error('No session found');
		return {
			message: 'No session found',
			error: true,
			success: false,
			account: null,
		}
	}
	const account = await session.value.getAccount();
	if (account.isErr()) {
		terminal.error('Error retrieving account:', account.error);
		return {
			message: 'Account retrieval error',
			error: true,
			success: false,
			account: null,
		}
	}

	if (!account.value) {
		terminal.error('No account found in session');
		return {
			message: 'No account found',
			error: false,
			success: false,
			account: null,
		}
	}
	return {
		message: 'Account retrieved successfully',
		error: false,
		success: true,
		account: account.value.data.profile,
	}
};
