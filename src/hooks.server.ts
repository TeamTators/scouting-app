import { type Handle } from '@sveltejs/kit';
import { ServerCode } from 'ts-utils/status';
import terminal from '$lib/server/utils/terminal';
import '$lib/server/utils/files';
import createTree from '../scripts/create-route-tree';
import { createServerClient } from '@supabase/ssr';
import env from '$lib/server/utils/env';
import type { Database } from '$lib/types/supabase';
import { SupaStruct } from '$lib/services/supabase/supastruct.svelte';
import supabase from '$lib/server/services/supabase';
import '$lib/server';
import ignore from 'ignore';

const include = ignore();
const ig = ignore();
ig.add([
	'/account/sign-up',
	'/account/sign-in',
	'/account/sign-out',
	'**/assets/**',
	'/account/recover',
	'/api/**',
	'/test/**',
	'/examples/**',
]);

const include_in_session = (pathname: string) => {
	if (pathname.startsWith('/')) pathname = pathname.slice(1);
	if (pathname.length === 0) return true;
	// console.log('Checking if path should be included in session:', pathname);
	const ignored = ig.ignores(pathname);
	if (ignored) {
		// console.log('Path ignored by ignore package:', pathname);
		return false;
	}
	// if it's ignored by the ig, it should be included in the session
	// Yes, this is a bit confusing but it's just a not of the ignore package's behavior
	const result = include.ignores(pathname);
	// console.log('Path included in session:', result);
	return result;
}

(async () => {
	await createTree().then((res) => {
		if (res) include.add(res.split('\n'));
	});
})();

export const handle: Handle = async ({ event, resolve }) => {
	// console.log('Request:', event.request.method, event.url.pathname);
	event.locals.start = performance.now();
	event.locals.supabase = Object.assign(
		createServerClient<Database>(env.SB_PROJECT_URL, env.SB_PUBLIC_KEY, {
			cookies: {
				getAll: () => event.cookies.getAll(),
				setAll: (cookies) => {
					try {
						for (const cookie of cookies) {
							event.cookies.set(cookie.name, cookie.value, cookie.options);
							// terminal.log(`Set cookie: ${cookie.name}=${cookie.value}`);
						}
					} catch (error) {
						terminal.error('Error setting cookies:', error);
					}
				}
			}
		}),
		{
			serviceRole: false
		}
	);
	const SessionStruct = SupaStruct.get({
		schema: 'core',
		table: 'session',
		client: supabase,
	});

	const cookie = event.cookies.get('ssid');
	SESSION: if (cookie) {
		const sessionRes = await SessionStruct.get({ id: cookie }).first();
		// console.log('Session Result: ', sessionRes);
		if (sessionRes.isErr()) {
			// terminal.error('Error getting session from cookie:', sessionRes.error);
			event.locals.session = null;
		}
		if (sessionRes.isOk() && !sessionRes.value) {
			// console.log('Session not found, creating new session');
			// create new session
			const res = await SessionStruct.new({
				prev_url: event.url.pathname
			});
			// console.log('New Session Result: ', res);
			if (res.isErr()) {
				terminal.error('Error creating new session:', res.error);
			} else {
				event.locals.session = res.value[0];
				event.cookies.set('ssid', res.value[0].raw.id, {
					httpOnly: true,
					path: '/',
				});
			}
		}
		if (sessionRes.isOk() && sessionRes.value) {
			// console.log('Session found:', sessionRes.value);
			event.locals.session = sessionRes.value;
			const include = include_in_session(event.url.pathname);
			if (include) {
				// console.log('Updating session with prev_url:', event.url.pathname);
				// don't await so it's non-blocking'
				sessionRes.value.update({
					prev_url: event.url.pathname
				}).then((res) => {
					if (res.isErr()) {
						terminal.error('Error updating session:', res.error);
					}
				});
			}
		}
	} else {
		const include = include_in_session(event.url.pathname);
		// console.log('No session cookie found, creating new session. Include in session:', include);
		if (!include) break SESSION; // don't create a new session if the page is ignored. This is to prevent bots from creating sessions for every page they visit.
		const res = await SessionStruct.new({
			prev_url: event.url.pathname
		});

		if (res.isErr()) {
			terminal.error('Error creating new session:', res.error);
		} else {
			event.locals.session = res.value[0];
			event.cookies.set('ssid', res.value[0].raw.id, {
				httpOnly: true,
				path: '/'
			});
		}
	}

	try {
		const res = await resolve(event, {
			filterSerializedResponseHeaders: (name) => {
				return ['content-range'].includes(name.toLowerCase());
			}
		});
		return res;
	} catch (error) {
		terminal.error(error);
		// redirect to error page
		return new Response('Redirect', {
			status: ServerCode.seeOther,
			headers: {
				location: `/status/${ServerCode.internalServerError}`
			}
		});
	}
};
