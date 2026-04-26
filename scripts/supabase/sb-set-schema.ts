import fs from 'fs/promises';
import path from 'path';
import { str } from '../../src/lib/server/utils/env-utils';

export default async (schema: string) => {
	let tackOn = false;
	if (schema.startsWith('+=')) {
		tackOn = true;
		schema = schema.slice(2);
	}

	const validChars = /[a-z0-9_]+$/;
	if (!validChars.test(schema)) {
		throw new Error(
			'Invalid schema name. Only lowercase letters, numbers, and underscores are allowed.'
		);
	}

	const notAllowed = [
		'dashboard_user',
		'pgbouncer',
		'anon',
		'authenticated',
		'service_role',
		'postgres',
		'supabase_auth_admin',
		'supabase_read_only_user',
		'supabase_realtime_admin',
		'supabase_replication_admin',
		'supabase_storage_admin'
	];

	if (notAllowed.includes(schema)) {
		throw new Error(`The schema name "${schema}" is reserved and cannot be used.`);
	}

	const currentSchema = str('SB_SCHEMA', true);
	console.log(`Current schema: ${currentSchema}`);
	if (tackOn) {
		schema = currentSchema + '_' + schema;
	}

	const migrations = await fs.readdir(path.join(process.cwd(), 'supabase', 'migrations'));

	console.log(`New schema: ${schema}`);
	const filesToEdit = [
		'./src/lib/types/supabase.ts',
		'./src/lib/types/supabase-schema.ts',
		'./supabase/snippets/create_schema.sql',
		'./supabase/config.toml',
		'./.env',
		'./.env.example',
		...migrations.map((file) => `./supabase/migrations/${file}`)
	];
	const date = Date.now();

	// backup files
	for (const file of filesToEdit) {
		try {
			const filePath = path.resolve(process.cwd(), file);
			const name = path.basename(filePath);
			const backupPath = path.join(
				process.cwd(),
				'private',
				'backups',
				path.dirname(file),
				`${date}_${name}.backup`
			);
			await fs.mkdir(path.dirname(backupPath), { recursive: true });
			await fs.copyFile(filePath, backupPath);
			console.log(`Backed up ${file} to ${backupPath}`);

			const contents = await fs.readFile(filePath, 'utf-8');
			const updatedContents = contents.replace(new RegExp(currentSchema, 'g'), schema);
			await fs.writeFile(filePath, updatedContents, 'utf-8');
			console.log(`Updated ${file} with new schema name: ${schema}`);
		} catch (error) {
			console.warn(`Failed to update ${file}:`, error);
			console.warn(
				`Please check the file manually to ensure the schema name is updated to ${schema}.`
			);
		}
	}
};
