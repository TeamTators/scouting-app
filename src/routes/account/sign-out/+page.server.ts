/**
 * @fileoverview Server load/actions for `/account/sign-out`.
 */
/**
 * @fileoverview Server load/actions for `/account/sign-out`.
 */
import { redirect } from '@sveltejs/kit';
import { ServerCode } from 'ts-utils/status';

export const load = async (event) => {
	if (!event.locals.session) return;
	const account = await event.locals.session.getAccount();
	if (account.isErr()) return;
	if (!account.value) throw redirect(ServerCode.seeOther, '/account/sign-in');
};

export const actions = {
	'sign-out': async (event) => {
		const session = event.locals.session;
		if (!session) {
			return {
				success: false,
				message: 'An error occurred while signing out. Please try again later.'
			};
		}

		const signOutRes = await session.signOut();
		if (signOutRes.isErr()) {
			return {
				success: false,
				message: 'An error occurred while signing out. Please try again later.'
			};
		}

		throw redirect(ServerCode.seeOther, '/account/sign-in');
	}
};
