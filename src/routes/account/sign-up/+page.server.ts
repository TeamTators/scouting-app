/**
 * @fileoverview Server load/actions for `/account/sign-up`.
 */
import { fail } from '@sveltejs/kit';
import { domain } from '$lib/server/utils/env-utils';
import { SupaStruct } from '$lib/services/supabase/supastruct.svelte';

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

		const profileStruct = SupaStruct.get({
			schema: 'core',
			table: 'profile',
			client: supabase
		});

		const exists = await profileStruct.getOR({
			username,
			email
		});

		if (exists.isErr()) {
			return {
				success: false,
				message: 'An error occurred while checking your information. Please try again later.'
			};
		}

		if (exists.value.length) {
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
			const res = await profileStruct.new({
				username,
				first_name: firstName,
				last_name: lastName,
				id: data.user.id,
				email
			});

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
				redirect: '/account/sign-in'
			};
		}

		return {
			success: false,
			message: 'An unexpected error occurred. Please try again later.'
		};
	}
};
