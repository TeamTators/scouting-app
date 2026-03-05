import { getAccountFactory } from '$lib/model/account';
import { fail } from '@sveltejs/kit';

export const load = async (event) => {
	const { username } = event.params;
	const { supabase } = event.locals;

	const accountFactory = getAccountFactory(supabase, {
		debug: true
	});

	const res = await accountFactory.search(
		{
			field: 'username',
			operator: 'eq',
			value: username
		},
		{
			type: 'single'
		}
	);
	if (res.isErr()) {
		throw fail(500, {
			message: 'An error occurred while fetching the account. Please try again later.'
		});
	}
	if (!res.value) {
		throw fail(404, {
			message: 'Account not found.'
		});
	}

	return {
		account: res.value.data
	};
};
