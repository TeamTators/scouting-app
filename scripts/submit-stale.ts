import { Struct } from 'drizzle-struct/back-end';
import { Scouting } from '../src/lib/server/structs/scouting';
import { DB } from '../src/lib/server/db';

export default async (event: string) => {
	if (!event) throw new Error('Must provide an event key');
	await Struct.buildAll(DB).unwrap();

	await Scouting.submitStale(event);
};
