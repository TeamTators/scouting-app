import { type Handle } from '@sveltejs/kit';
import { ServerCode } from 'ts-utils/status';
import terminal from '$lib/server/utils/terminal';
import '$lib/server/utils/files';
// import { signFingerprint } from '$lib/server/utils/fingerprint';
import createTree from '../scripts/create-route-tree';
// import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { type DB } from '$lib/types/supabase';
import { getSessionFactory } from '$lib/server/model/session';
import env from '$lib/server/utils/env';

(async () => {
	await createTree();
})();
export const handle: Handle = async ({ event, resolve }) => {
	// console.log('Request:', event.request.method, event.url.pathname);
	event.locals.start = performance.now();
	event.locals.supabase = createServerClient<DB>(env.SB_PROJECT_URL, env.SB_PUBLIC_KEY, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookies) => {
				for (const cookie of cookies) {
					event.cookies.set(cookie.name, cookie.value, cookie.options);
					// terminal.debug(`Set cookie: ${cookie.name}=${cookie.value}`);
				}
			}
		}
	});

	// TODO: only save pages
	const sessionFactory = getSessionFactory(event.locals.supabase, {
		debug: false
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
