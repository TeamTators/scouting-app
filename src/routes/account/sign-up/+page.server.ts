/**
 * @fileoverview Server load/actions for `/account/sign-up`.
 */
import { fail, redirect } from '@sveltejs/kit';
import { ServerCode } from 'ts-utils/status';
import { OAuth2Client } from 'google-auth-library';
import { domain, str } from '$lib/server/utils/env';
import { getAccountFactory } from '$lib/model/account';
import serverSB from '$lib/server/services/supabase';

// export const load = async (event) => {
// 	const res = await event.locals.getSession();

// 	if (res.isErr()) {
// 		return {
// 			session: null
// 		};
// 	}

// 	return { url: event.url.origin };
// };

export const actions = {
	register: async (event) => {
		const {
			request,
			locals: { supabase }
		} = event;
		const formData = await request.formData();
		const email = String(formData.get('email'));
		const password = String(formData.get('password'));
		const validEmail = /^[\w-.+]+@([\w-]+\.)+[\w-]{2,8}$/.test(email);
		const username = String(formData.get('username'));
		const firstName = String(formData.get('firstName'));
		const lastName = String(formData.get('lastName'));

		if (!validEmail) {
			return {
				success: false,
				message: 'Please enter a valid email address.'
			};
		}

		const accountFactory = getAccountFactory(serverSB, {
			debug: true
		});

		const exists = await accountFactory.profile.getOR(
			{
				username,
				email
			},
			{
				type: 'single'
			}
		);

		if (exists.isErr()) {
			return {
				success: false,
				message: 'An error occurred while checking your information. Please try again later.'
			};
		}

		if (exists.value) {
			return {
				success: false,
				message: 'An account with that email or username already exists.'
			};
		}
		const { data, error } = await supabase.auth.signUp({
			email,
			password,
			options: {
				emailRedirectTo: domain({
					protocol: true,
					port: false
				})
			}
		});

		if (error) {
			return fail(400, { errors: { email: error.message }, email });
		}

		if (data.user) {
			const res = await accountFactory.profile
				.new({
					username,
					first_name: firstName,
					last_name: lastName,
					id: data.user.id,
					email
				})
				.await();

			if (res.isErr()) {
				throw fail(500, {
					errors: {
						profile: 'An error occurred while creating your profile. Please try again later.'
					}
				});
			}

			return {
				success: true,
				message: 'Registration successful! Please check your email to confirm your account.',
				redirect: '/account/sign-in',
			};
		}

		return {
			success: false,
			message: 'An unexpected error occurred. Please try again later.'
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
		const redirectUri = `${url}/api/oauth/sign-up`;
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
	}
};
