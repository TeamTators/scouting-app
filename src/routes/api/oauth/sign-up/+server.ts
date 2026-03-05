/**
 * @fileoverview OAuth sign-up endpoint at `/api/oauth/sign-up`.
 */
import { SupaStruct } from '$lib/services/supabase/supastruct.js';
import { error, redirect } from '@sveltejs/kit';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { ServerCode } from 'ts-utils/status';
import { domain, str } from '$lib/server/utils/env.js';
import supabase from '$lib/server/services/supabase.js';
import terminal from '$lib/server/utils/terminal.js';

export const GET = async (event) => {
	const code = event.url.searchParams.get('code');
	if (!code) throw redirect(ServerCode.temporaryRedirect, '/account/sign-up');
	const url = domain({
		port: false,
		protocol: true
	});
	const redirectUri = `${url}/api/oauth/sign-up`;
	try {
		const client = new OAuth2Client({
			clientId: str('OAUTH2_CLIENT_ID', true),
			clientSecret: str('OAUTH2_CLIENT_SECRET', true),
			redirectUri
		});
		// log(client);

		const r = await client.getToken(code);
		client.setCredentials(r.tokens);

		const info = await google
			.oauth2({
				auth: client,
				version: 'v2'
			})
			.userinfo.get();

		const profile = SupaStruct.get({
			client: supabase,
			name: 'profile'
		});

		const exists = await profile.get(
			{
				email: String(info.data.email)
			},
			{
				type: 'single'
			}
		);
		if (exists.isErr()) {
			throw error(ServerCode.internalServerError, 'Failed to check if user exists');
		}
		if (exists.value) {
			throw error(ServerCode.conflict, 'User already exists');
		}

		const password = crypto.randomUUID();

		const { error: signUpError } = await supabase.auth.signUp({
			email: String(info.data.email),
			password,
			options: {
				emailRedirectTo: `${url}/account/sign-in`
			}
		});

		if (signUpError) {
			terminal.error('Failed to sign up user:', signUpError);
			throw error(ServerCode.internalServerError, 'Failed to sign up user');
		}

		const { error: resetPasswordError } = await supabase.auth.resetPasswordForEmail(
			String(info.data.email),
			{
				redirectTo: `${url}/account/sign-in`
			}
		);

		if (resetPasswordError) {
			terminal.error('Failed to send password reset email:', resetPasswordError);
			throw error(ServerCode.internalServerError, 'Failed to send password reset email');
		}

		const res = await profile
			.new({
				email: String(info.data.email),
				first_name: String(info.data.name).split(' ')[0],
				last_name: String(info.data.name).split(' ').slice(1).join(' '),
				username: String(info.data.email).split('@')[0]
			})
			.await();

		if (res.isErr()) {
			terminal.error('Failed to create user profile:', res.error);
			throw error(ServerCode.internalServerError, 'Failed to create user profile');
		}

		const { error: signInError } = await event.locals.supabase.auth.signInWithPassword({
			email: String(info.data.email),
			password
		});

		if (signInError) {
			terminal.error('Failed to sign in user:', signInError);
			throw error(ServerCode.internalServerError, 'Failed to sign in user');
		}

		throw redirect(ServerCode.temporaryRedirect, event.locals.session?.prevUrl || '/');
	} catch {
		// log(err);
	}

	throw redirect(ServerCode.temporaryRedirect, '/account/sign-in');
};
