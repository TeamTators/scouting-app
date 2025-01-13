import { fail } from '@sveltejs/kit';
import { Account } from '$lib/server/structs/account.js';
import { Session } from '$lib/server/structs/session.js';
import { ServerCode } from 'ts-utils/status';
import { z } from 'zod';

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
			return fail(ServerCode.badRequest, {
				message: 'Invalid form data',
				user: data.get('user')
			});
		}

		let account: Account.AccountData;

		ACCOUNT: {
			const user = await Account.Account.fromProperty('username', res.data.username, {
				type: 'single'
			});
			if (user.isErr()) {
				return fail(ServerCode.internalServerError, {
					user: res.data.username,
					message: 'Failed to get user'
				});
			}
			account = user.value;
			if (account) break ACCOUNT;

			const email = await Account.Account.fromProperty('email', res.data.username, {
				type: 'single'
			});
			if (email.isErr()) {
				return fail(ServerCode.internalServerError, {
					user: res.data.username,
					message: 'Failed to get user'
				});
			}
			account = email.value;
			if (account) break ACCOUNT;

			return fail(ServerCode.notFound, {
				user: res.data.username,
				message: 'User not found'
			});
		}

		const sessionRes = await Session.signIn(account, event);
		if (sessionRes.isErr()) {
			console.error(sessionRes.error);
			return fail(ServerCode.internalServerError, {
				user: res.data.username,
				message: 'Failed to sign in'
			});
		}

		return {
			message: 'Logged in',
			user: res.data.username,
			redirect: sessionRes.value.session.data.prevUrl || '/',
			success: true
		};
	}
};
