import fs from 'fs/promises';
import path from 'path';
import { config } from '../../src/lib/server/utils/env';

export default async () => {
	const dirpath = path.join(process.cwd(), 'supabase', 'migrations');
	const outpath = path.join(process.cwd(), 'private', 'migrations');

	// clear outpath
	await fs.rm(outpath, { recursive: true, force: true });
	await fs.mkdir(outpath, { recursive: true });

	const files = await fs.readdir(dirpath);
	const schema = config.supabase.schema;

	await Promise.all(
		files.map(async (file) => {
			const content = await fs.readFile(path.join(dirpath, file), 'utf-8');
			// local_schema -> actual schema
			const migrated = content.replace(new RegExp(schema, 'g'), 'local_schema');
			await fs.writeFile(path.join(outpath, file), migrated, 'utf-8');
		})
	);
};
