/**
 * @fileoverview Server load/actions for `/account/sign-in`.
 */
import { fail } from '@sveltejs/kit';
import { getAccountFactory } from '$lib/model/account.js';
import { ServerCode } from 'ts-utils/status';
import { z } from 'zod';
import terminal from '$lib/server/utils/terminal';
import serverSB from '$lib/server/services/supabase';

export const actions = {
	login: async (event) => {
		const data = await event.request.formData();
		const res = z
			.object({
				username: z.string(),
				password: z.string()
			})
			.safeParse({
				username: data.get('user'),
				password: data.get('password')
			});
		if (!res.success) {
			terminal.error(res.error);
			return fail(ServerCode.badRequest, {
				message: 'Invalid form data',
				user: data.get('user')
			});
		}

		let email = res.data.username;
		// is a username
		if (!email.includes('@')) {
			const factory = getAccountFactory(serverSB);
			const profile = await factory.profile.get(
				{
					username: email
				},
				{
					type: 'single'
				}
			);
			if (profile.isErr()) {
				terminal.error(profile.error);
				throw fail(ServerCode.internalServerError, {
					message: 'An error occurred while logging in',
					user: res.data.username
				});
			} else {
				if (profile.value && profile.value.data.email) {
					email = profile.value.data.email;
				} else {
					return fail(ServerCode.unauthorized, {
						message: 'Invalid username/email or password',
						user: res.data.username
					});
				}
			}
		}

		return {
			message: 'Logged in',
			user: res.data.username,
			redirect: event.locals.session?.prevUrl,
			success: true
		};
	}
};
