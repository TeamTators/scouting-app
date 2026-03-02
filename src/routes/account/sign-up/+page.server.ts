/**
 * @fileoverview Server load/actions for `/account/sign-up`.
 */
import { redirect } from '@sveltejs/kit';
import { ServerCode } from 'ts-utils/status';
import { OAuth2Client } from 'google-auth-library';
import { domain, str } from '$lib/server/utils/env';

export const load = async (event) => {
	const res = await event.locals.getSession();

	if (res.isErr()) {
		return {
			session: null
		};
	}

	if (res.value.session) {
		redirect(ServerCode.seeOther, '/account');
	}

	return { url: event.url.origin };
};

export const actions = {
	default: async (event) => {},
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
