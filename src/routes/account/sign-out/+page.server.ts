/**
 * @fileoverview Server load/actions for `/account/sign-out`.
 */
/**
 * @fileoverview Server load/actions for `/account/sign-out`.
 */
import { redirect } from '@sveltejs/kit';
import { ServerCode } from 'ts-utils/status';

export const load = async (event) => {
	const session = await event.locals.getSession();
	if (session.isErr()) return;
	if (!session.value) return;
	const account = await session.value.getAccount();
	if (account.isErr()) return;
	if (!account.value) throw redirect(ServerCode.seeOther, '/account/sign-in');
};

export const actions = {
	'sign-out': async (event) => {
		const session = await event.locals.getSession();
		if (session.isErr()) {
			return {
				success: false,
				message: 'An error occurred while signing out. Please try again later.'
			};
		}

		if (!session.value) {
			throw redirect(ServerCode.seeOther, '/account/sign-in');
		}

		const signOutRes = await session.value.signOut();
		if (signOutRes.isErr()) {
			return {
				success: false,
				message: 'An error occurred while signing out. Please try again later.'
			};
		}

		 throw redirect(ServerCode.seeOther, '/account/sign-in');
	}
};