/**
 * @fileoverview Base RPC helpers for session/account context.
 *
 * These remotes provide safe access to server-side locals and are used as
 * building blocks for other remotes.
 *
 * @example
 * import * as baseRemote from '$lib/remotes/index.remote';
 * const isLoggedIn = await baseRemote.isLoggedIn();
 */
import { getRequestEvent, query } from '$app/server';
import terminal from '$lib/server/utils/terminal';

/**
 * Returns true when the current account is an administrator.
 */
export const isAdmin = query(async () => {
	const event = getRequestEvent();
	const session = event.locals.session;
	if (!session) return false;
	const data = await session.getAccount();
	if (data.isErr()) {
		terminal.error('Error fetching account in isAdmin remote:', data.error);
		return false;
	}
	return (await data.value?.isAdmin().unwrapOr(false)) ?? false;
});

/**
 * Returns true when a user is signed in.
 */
export const isLoggedIn = query(async () => {
	const event = getRequestEvent();
	const session = event.locals.session;
	if (!session) return false;
	const data = await session.getAccount();
	if (data.isErr()) {
		terminal.error('Error fetching account in isLoggedIn remote:', data.error);
		return false;
	}
	return !!data.value;
});

/**
 * Returns the current account or null.
 */
export const getAccount = query(async () => {
	const event = getRequestEvent();
	const session = event.locals.session;
	if (!session) return null;
	const data = await session.getAccount();
	if (data.isErr()) {
		terminal.error('Error fetching account in getAccount remote:', data.error);
		return null;
	}
	return data.value || null;
});
// /**
//  * Returns the current SSE connection if available.
//  */
// export const getSSE = query(async () => {
// 	const event = getRequestEvent();
// 	return event.locals.sse;
// });
