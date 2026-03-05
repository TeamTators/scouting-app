import { type Handle } from '@sveltejs/kit';
import { ServerCode } from 'ts-utils/status';
import terminal from '$lib/server/utils/terminal';
import '$lib/server/utils/files';
// import { signFingerprint } from '$lib/server/utils/fingerprint';
import createTree from '../scripts/create-route-tree';
// import { createClient } from '@supabase/supabase-js';
import { config } from '$lib/server/utils/env';
import { createServerClient } from '@supabase/ssr';
import { type DB } from '$lib/services/supabase/supastruct';
import { getSessionFactory } from '$lib/server/model/session';
import { sse } from '$lib/server/services/sse';

(async () => {
	await createTree();
})();
export const handle: Handle = async ({ event, resolve }) => {
	// console.log('Request:', event.request.method, event.url.pathname);
	event.locals.start = performance.now();
	event.locals.supabase = createServerClient<DB>(
		`${config.supabase.protocol}://${config.supabase.domain}:${config.supabase.port}`,
		config.supabase.anon_key,
		{
			cookies: {
				getAll: () => event.cookies.getAll(),
				setAll: (cookies) => {
					for (const cookie of cookies) {
						event.cookies.set(cookie.name, cookie.value, cookie.options);
						// terminal.debug(`Set cookie: ${cookie.name}=${cookie.value}`);
					}
				}
			}
		}
	);

	const connectionKey = event.request.headers.get('x-sse');
	if (connectionKey) {
		event.locals.sse = sse.getConnection(connectionKey);
	}

	// TODO: only save pages
	const sessionFactory = getSessionFactory(event.locals.supabase, {
		debug: true
	});

	const res = await sessionFactory.getSelf(event.url.pathname);
	if (res.isErr()) {
		terminal.error('Error getting session:', res.error);
		event.locals.session = null;
	} else {
		event.locals.session = res.value;
	}
	try {
		const res = await resolve(event);
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
