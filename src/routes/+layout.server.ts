export const load = async (event) => {
	const session = event.locals.session;
	if (!session) {
		return {
			session: null,
			user: null,
			cookies: event.cookies.getAll()
		};
	}
	const user = await session.getUser();
	if (user.isErr()) {
		return {
			session: session.config.session,
			user: null,
			cookies: event.cookies.getAll()
		};
	}
	return {
		session: session.config.session,
		user: user.unwrap(),
		cookies: event.cookies.getAll()
	};
};
