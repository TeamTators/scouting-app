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

(async () => {
	await createTree();
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
							event.cookies.set(cookie.name, cookie.value, {
								...cookie.options,
								httpOnly: true,
								path: '/'
							});
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
		client: supabase
	});

	const cookie = event.cookies.get('ssid');
	if (cookie) {
		const sessionRes = await SessionStruct.fromId(cookie);
		if (sessionRes.isErr()) {
			// terminal.error('Error getting session from cookie:', sessionRes.error);
			event.locals.session = null;
		}
		if (sessionRes.isOk() && !sessionRes.value) {
			// create new session
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
		if (sessionRes.isOk() && sessionRes.value) {
			event.locals.session = sessionRes.value;
		}
	} else {
		const res = await SessionStruct.new({
			prev_url: event.url.pathname
		});
		// }

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
