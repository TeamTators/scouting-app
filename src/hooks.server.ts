import { type Handle } from '@sveltejs/kit';
import { ServerCode } from 'ts-utils/status';
import terminal from '$lib/server/utils/terminal';
import '$lib/server/utils/files';
// import { signFingerprint } from '$lib/server/utils/fingerprint';
import createTree from '../scripts/create-route-tree';
// import { createClient } from '@supabase/supabase-js';
import { config } from '$lib/server/utils/env';
import { createServerClient } from '@supabase/ssr';
import { attemptAsync } from 'ts-utils';
import type { Session } from '@supabase/supabase-js';
import { Account, getAccountFactory } from '$lib/model/account';
import { type DB } from '$lib/services/supabase/supastruct';

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

	const accountFactory = getAccountFactory(event.locals.supabase, {
		debug: true,
	});

	let user: Session['user'] | null = null;
	let session: Session | null = null;
	let account: Account | null = null;
	event.locals.getSession = () => {
		return attemptAsync(async () => {
			if (user && session) {
				return { user, session, account };
			}
			const userData = await event.locals.supabase.auth.getUser();
			const sessionData = await event.locals.supabase.auth.getSession();
			if (userData.error) throw userData.error;
			if (sessionData.error) throw sessionData.error;
			user = userData.data.user;
			session = sessionData.data.session;
			const accountRes = await accountFactory.getSelf();
			if (accountRes.isErr()) {
				terminal.log('Error fetching account:', accountRes.error);
			} else {
				account = accountRes.value;
			}
			return { user: userData.data.user, session: sessionData.data.session, account };
		});
	};
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
