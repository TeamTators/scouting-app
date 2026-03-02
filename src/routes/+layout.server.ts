export const load = async (event) => {
	const res = await event.locals.getSession();
	if (res.isErr()) {
		return {
			session: null,
			user: null,
			cookies: event.cookies.getAll()
		};
	}
};
