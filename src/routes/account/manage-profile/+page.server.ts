/**
 * @fileoverview Server load/actions for `/account/manage-profile`.
 */
import { redirect } from '@sveltejs/kit';
import { ServerCode } from 'ts-utils/status';

export const load = async (event) => {
	if (!event.locals.session) {
		throw redirect(ServerCode.seeOther, '/account/sign-up');
	}

	const account = await event.locals.session.getAccount();
	if (account.isErr()) {
		throw redirect(ServerCode.seeOther, '/account/sign-up');
	}

	return {
		account: account.value?.profile.data
	};
};
