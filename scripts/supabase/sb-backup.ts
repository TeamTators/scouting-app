/* eslint-disable @typescript-eslint/no-explicit-any */
import AdmZip from 'adm-zip';
import env from '../../src/lib/server/utils/env';
import supabase from '../../src/lib/server/services/supabase';
import path from 'path';
import fs from 'fs';
import * as csv from 'csv';

// Helper to ensure a write stream is fully flushed and closed
const finishStream = (stream: fs.WriteStream): Promise<void> => {
	return new Promise((resolve, reject) => {
		stream.on('finish', resolve);
		stream.on('error', reject);
	});
};

export default async (...args: string[]) => {
	let schemas = env.SB_SCHEMAS.slice();
	schemas.push('public');
	schemas = Array.from(new Set(schemas)); // remove duplicates

	const { data, error } = await supabase.rpc('get_schemas_and_tables');
	if (error) throw new Error(`Error fetching schemas and tables: ${error.message}`);
	if (!data) throw new Error('No data returned from get_schemas_and_tables');

	const export_dir = path.resolve(process.cwd(), 'backups');
	await fs.promises.mkdir(export_dir, { recursive: true });

	const files: string[] = [];

	// 1. Export Users (if not excluded)
	if (!args.includes('exclude-users')) {
		const users = await supabase.auth.admin.listUsers();
		if (users.error) throw new Error(`Error fetching users: ${users.error.message}`);

		const users_csv = path.join(export_dir, 'auth-users.csv');
		files.push(users_csv);

		const writeStream = fs.createWriteStream(users_csv);
		const stringifier = csv.stringify({ header: true });
		stringifier.pipe(writeStream);

		users.data.users.forEach((user) => {
			stringifier.write(user);
		});

		stringifier.end();
		await finishStream(writeStream);
	}

	// 2. Export Tables
	const tableRows = data.filter(({ schema_name }) => schemas.includes(schema_name));

	for (const row of tableRows) {
		const { schema_name, table_name } = row;
		const table_csv = path.join(export_dir, `${schema_name}-${table_name}.csv`);
		files.push(table_csv);

		const writeStream = fs.createWriteStream(table_csv);
		const stringifier = csv.stringify({ header: true });
		stringifier.pipe(writeStream);

		let offset = 0;
		const limit = 1000;
		let hasMore = true;

		while (hasMore) {
			// Note: Added an order clause (assumes a primary 'id' column exists. Adjust if your tables use a different primary key)
			const { data: table_data, error: table_error } = await supabase
				.schema(schema_name as any)
				.from(table_name as any)
				.select('*')
				.order('id' as any, { ascending: true })
				.range(offset, offset + limit - 1);

			if (table_error) {
				console.error(
					`Error fetching data from ${schema_name}.${table_name}: ${table_error.message}`
				);
				break;
			}

			if (!table_data || table_data.length === 0) {
				hasMore = false;
				break;
			}

			table_data.forEach((row: any) => {
				stringifier.write(row);
			});

			if (table_data.length < limit) {
				hasMore = false;
			} else {
				offset += limit;
			}
		}

		stringifier.end();
		await finishStream(writeStream);
	}

	// 3. Create Zip Archive
	const zip = new AdmZip();
	for (const file of files) {
		zip.addLocalFile(file);
	}

	const export_name = args.find((arg) => arg.startsWith('name='))?.split('=')[1];
	const file_name = export_name
		? `supabase-export-${export_name}-${Date.now()}.zip`
		: `supabase-export-${Date.now()}.zip`;

	const zipPath = path.join(export_dir, file_name);
	zip.writeZip(zipPath);

	// 4. Cleanup temporary CSV files
	for (const file of files) {
		await fs.promises.unlink(file);
	}

	console.log(`Exported data successfully to ${zipPath}`);
};
