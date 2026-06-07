/**
 * @fileoverview Server load/actions for `/account/sign-in`.
 */
import { fail } from '@sveltejs/kit';
import { ServerCode } from 'ts-utils/status';
import { z } from 'zod';
import terminal from '$lib/server/utils/terminal';
import serverSB from '$lib/server/services/supabase';
import { SupaStruct } from '$lib/services/supabase/supastruct.svelte';

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

		const profileStruct = SupaStruct.get({
			schema: 'core',
			table: 'profile',
			client: serverSB
		});

		let email = res.data.username;
		// is a username
		if (!email.includes('@')) {
			const profile = await profileStruct.get({
				username: email
			});
			if (profile.isErr()) {
				terminal.error(profile.error);
				return fail(ServerCode.internalServerError, {
					message: 'An error occurred while logging in',
					user: res.data.username
				});
			} else {
				if (profile.value.length && profile.value[0].raw.email) {
					email = profile.value[0].raw.email;
				} else {
					return fail(ServerCode.unauthorized, {
						message: 'Invalid username/email or password',
						user: res.data.username
					});
				}
			}
		}

		const { error } = await event.locals.supabase.auth.signInWithPassword({
			email: email,
			password: res.data.password
		});

		if (error) {
			terminal.error('Error signing in:', error);
			return fail(ServerCode.unauthorized, {
				message: 'Invalid username/email or password',
				user: res.data.username
			});
		}


		return {
			message: 'Logged in',
			user: res.data.username,
			redirect: event.locals.session?.raw.prev_url,
			success: true
		};
	}
};
