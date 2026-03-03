export const load = async (event) => {
	const res = await event.locals.getSession();
	if (res.isErr()) {
		return {
			session: null,
			user: null,
			cookies: event.cookies.getAll()
		};
	}
	const session = res.value;
	if (!session) {
		return {
			session: null,
			user: null,
			cookies: event.cookies.getAll()
		}
	}
	const user = await session.getUser();
	if (user.isErr()) {
		return {
			session: session.config.session,
			user: null,
			cookies: event.cookies.getAll()
		}
	}
	return {
		session: session.config.session,
		user: user.value,
		cookies: event.cookies.getAll()
	};
};
