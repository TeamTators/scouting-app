import fs from 'fs/promises';
import path from 'path';
import supabase from '../../src/lib/server/services/supabase';
import { sb } from '../../src/lib/server/services/supabase';

export default async () => {
	const sql = await fs.readFile(
		path.resolve(process.cwd(), 'supabase', 'enable-realtime.sql'),
		'utf-8'
	);

	const replacedSql = sql.replace(/{{ schema_name }}/g, sb.schema);

	const { data, error } = await supabase.rpc('execute_sql', { sql: replacedSql });

	if (error) {
		console.error('Error enabling realtime:', error);
	} else {
		console.log('Realtime enabled successfully:', data);
	}
};
