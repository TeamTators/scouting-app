import { type Handle } from '@sveltejs/kit';
import { ServerCode } from 'ts-utils/status';
import terminal from '$lib/server/utils/terminal';
import '$lib/server/utils/files';
// import { signFingerprint } from '$lib/server/utils/fingerprint';
import redis from '$lib/server/services/redis';
import createTree from '../scripts/create-route-tree';

(async () => {
	await redis.init();
	await createTree();
})();
export const handle: Handle = async ({ event, resolve }) => {
	// console.log('Request:', event.request.method, event.url.pathname);
	event.locals.start = performance.now();
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
