import { Session } from '$lib/server/structs/session.js';

export const GET = async (event) => {
	const session = await Session.getSession(event);
	if (session.isErr()) return new Response('Unable to read session', { status: 500 });
	const account = await Session.getAccount(session.value);
	if (account.isErr()) return new Response('Unable to read account', { status: 500 });
	if (!account.value) return new Response('Not logged in', { status: 401 });

	return new Response(JSON.stringify(account.value.safe()), { status: 200 });
};
