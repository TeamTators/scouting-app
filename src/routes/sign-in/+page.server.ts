import { Remote } from '$lib/server/structs/remote.js';
import { fail, redirect } from '@sveltejs/kit';
import { ServerCode } from 'ts-utils/status';

export const actions = {
	'sign-in': async (event) => {
		const form = await event.request.formData();
		const pin = form.get('pin');
		if (pin !== Remote.PIN) {
			return fail(ServerCode.unauthorized, {
				message: 'Invalid PIN'
			});
		}

		const session = event.locals.session;
		const exists = (
			await Remote.TrustedSessions.fromProperty('ssid', session.data.id, {
				type: 'single'
			})
		).unwrap();
		if (!exists) {
			Remote.TrustedSessions.new({
				ssid: session.data.id
			});
		}

		return redirect(ServerCode.seeOther, '/');
	}
};
