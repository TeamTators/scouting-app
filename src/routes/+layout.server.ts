import { Session } from '$lib/server/structs/session.js';
import { config } from 'dotenv';
import { Struct } from 'drizzle-struct/back-end';
import '$lib/server/structs/account';
import '$lib/server/structs/permissions';
import '$lib/server/structs/universe';
import { DB } from '$lib/server/db/';
import { handleEvent, connectionEmitter } from '$lib/server/event-handler';

config();

Struct.each((struct) => {
	if (!struct.built) {
		struct.build(DB);
		struct.eventHandler(handleEvent(struct));
		connectionEmitter(struct);
	}
});

export const load = async (event) => {
	const session = await Session.getSession(event);
	if (session.isErr()) {
		return {
			status: 500,
			error: 'Failed to get session'
		};
	}
};
