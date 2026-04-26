/**
 * @fileoverview OAuth sign-in endpoint at `/api/oauth/sign-in`.
 */
import { redirect } from '@sveltejs/kit';
import { ServerCode } from 'ts-utils/status';

// const log = (...args: unknown[]) => console.log('[oauth/sign-in]', ...args);

export const GET = async (event) => {
	const code = event.url.searchParams.get('code');
	if (!code) throw redirect(ServerCode.temporaryRedirect, '/account/sign-up');
	const { searchParams, origin } = new URL(event.request.url);
	// if "next" is in param, use it as the redirect URL
	let next = searchParams.get('next') ?? '/';
	if (!next.startsWith('/')) {
		// if "next" is not a relative URL, use the default
		next = '/';
	}
	if (code) {
		const { error } = await event.locals.supabase.auth.exchangeCodeForSession(code);
		if (!error) {
			const forwardedHost = event.request.headers.get('x-forwarded-host'); // original origin before load balancer
			const isLocalEnv = process.env.NODE_ENV === 'development';
			if (isLocalEnv) {
				// we can be sure that there is no load balancer in between, so no need to watch for X-Forwarded-Host
				return redirect(ServerCode.temporaryRedirect, `${origin}${next}`);
			} else if (forwardedHost) {
				throw redirect(ServerCode.temporaryRedirect, `https://${forwardedHost}${next}`);
			} else {
				throw redirect(ServerCode.temporaryRedirect, '/account/sign-up'); // fallback to sign-up page if we can't determine the original host
			}
		}
	}
	// return the user to an error page with instructions
	throw redirect(ServerCode.temporaryRedirect, '/account/sign-up');
};
