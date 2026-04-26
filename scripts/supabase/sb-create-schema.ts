import fs from 'fs/promises';
import path from 'path';
import supabase from '../../src/lib/server/services/supabase';

export default async () => {
	const sql = await fs.readFile(
		path.join(process.cwd(), 'supabase', 'snippets', 'create_schema.sql'),
		'utf-8'
	);

	// run sql
	await supabase.rpc('execute_sql', { sql });
};
