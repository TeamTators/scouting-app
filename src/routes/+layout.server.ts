import terminal from '$lib/server/utils/terminal.js';

export const load = async (event) => {
	const session = event.locals.session;
	if (!session) {
		return {
			session: null,
			user: null,
			cookies: event.cookies.getAll()
		};
	}

	const { data: userData, error: userError } = await event.locals.supabase.auth.getUser();
	if (userError) {
		terminal.error('Error getting user from session:', userError);
		return {
			user: null,
			cookies: event.cookies.getAll()
		};
	}

	return {
		user: userData?.user || null,
		cookies: event.cookies.getAll()
	};
};
