import { openStructs } from '../cli/struct';
import { Struct } from 'drizzle-struct';
import { DB } from '../src/lib/server/db';

export default async () => {
	await openStructs().unwrap();
	await Struct.buildAll(DB);

	await Promise.all(Array.from(Struct.structs).map(([, s]) => s.clear().unwrap()));
};
