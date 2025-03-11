import { text } from 'drizzle-orm/pg-core';
import { Struct } from 'drizzle-struct/back-end';

export namespace Remote {
	export const TrustedSessions = new Struct({
		name: 'trusted_sessions',
		structure: {
			ssid: text('ssid').notNull()
		}
	});

	export const PIN = process.env.REMOTE === 'true' ? String(process.env.REMOTE_PIN) : undefined;
}

export const _trustedSessions = Remote.TrustedSessions.table;
