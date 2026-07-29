/**
 * @fileoverview Server load/actions for `/account/sign-out`.
 */
/**
 * @fileoverview Server load/actions for `/account/sign-out`.
 */
import { redirect } from '@sveltejs/kit';

export const load = async (event) => {
	if (!event.locals.session) return;
	const { data: account, error } = await event.locals.supabase.auth.getUser();
	if (error) return;
	if (!account) throw redirect(303, '/account/sign-in');
};

export const actions = {
	'sign-out': async (event) => {
		// const session = event.locals.session;
		// if (!session) {
		// 	return {
		// 		success: false,
		// 		message: 'An error occurred while signing out. Please try again later.'
		// 	};
		// }

		const { error } = await event.locals.supabase.auth.signOut();

		if (error) {
			return {
				success: false,
				message: 'An error occurred while signing out. Please try again later.'
			};
		}

		throw redirect(303, '/account/sign-in');
	}
};
