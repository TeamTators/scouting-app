import { text } from 'drizzle-orm/pg-core';
import { Struct } from 'drizzle-struct/back-end';
import { bool, config, str } from '../utils/env';

export namespace Remote {
	export const TrustedSessions = new Struct({
		name: 'trusted_sessions',
		structure: {
			ssid: text('ssid').notNull()
		}
	});

	export const REMOTE = config.remote.enabled;
	// export const PIN = process.env.REMOTE === 'true' ? String(process.env.REMOTE_PIN) : undefined;
	export const PIN = (() => {
		const pin = config.remote.pin;
		return REMOTE ? pin : undefined;
	})();
}

export const _trustedSessions = Remote.TrustedSessions.table;
