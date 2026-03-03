/**
 * @fileoverview Server load/actions for `/account/sign-in`.
 */
/**
 * @fileoverview Server load/actions for `/account/sign-in`.
 */
import { fail, redirect } from '@sveltejs/kit';
import { getAccountFactory } from '$lib/model/account.js';
import { ServerCode } from 'ts-utils/status';
import { z } from 'zod';
import { OAuth2Client } from 'google-auth-library';
import terminal from '$lib/server/utils/terminal';
import { domain, str } from '$lib/server/utils/env';
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
			const profile = await factory.profile.get({
				username: email,
			}, {
				type: 'single',
			});
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
			redirect: event.locals.session.data.prevUrl || '/',
			success: true
		};
	},
	OAuth2: async () => {
		// const domain = String(process.env.PUBLIC_DOMAIN).includes('localhost')
		// 	? `${process.env.PUBLIC_DOMAIN}:${process.env.PORT}`
		// 	: process.env.PUBLIC_DOMAIN;
		// const protocol = process.env.HTTPS === 'true' ? 'https://' : 'http://';
		const url = domain({
			port: false,
			protocol: true
		});
		const redirectUri = `${url}/api/oauth/sign-in`;
		const client = new OAuth2Client({
			clientSecret: str('OAUTH2_CLIENT_SECRET', true),
			clientId: str('OAUTH2_CLIENT_ID', true),
			redirectUri
		});
		// log(client);
		const authorizeUrl = client.generateAuthUrl({
			access_type: 'offline',
			// scope: 'https://www.googleapis.com/auth/userinfo.profile openid email',
			scope: [
				'https://www.googleapis.com/auth/userinfo.profile',
				'https://www.googleapis.com/auth/userinfo.email',
				'openid'
			],
			prompt: 'consent'
		});
		// log(authorizeUrl);

		throw redirect(ServerCode.temporaryRedirect, authorizeUrl);
	},
	'request-password-reset': async (event) => {
		const formdata = await event.request.formData();
		const user = z.string().safeParse(formdata.get('user'));
		terminal.log(user);
		const exit = () => ({
			redirect: '/account/password-reset'
		});
		if (!user.success) {
			terminal.error(user.error);
			return exit();
		}

		let account = await Account.Account.get({ username: user.data }, { type: 'single' });
		if (account.isErr()) {
			terminal.error(account.error);
			return exit();
		}

		if (!account.value) {
			account = await Account.Account.get({ email: user.data }, { type: 'single' });
			if (account.isErr()) {
				terminal.error(account.error);
				return exit();
			}
		}

		if (!account.value) {
			return exit();
		}

		const reset = await Account.requestPasswordReset(account.value);

		if (reset.isErr()) {
			terminal.error(reset.error);
		}

		return exit();
	}
};
