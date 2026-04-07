import { runTask } from '../../src/lib/server/utils/task';
import { dbUrl } from '../../src/lib/server/services/supabase';

export default async (name: string) => {
	if (!name) throw new Error('Name is required for migration diff');

	const res = await runTask(
		'npx',
		'supabase',
		'db',
		'diff',
		'-f',
		name,
		'--db-url',
		dbUrl
	).unwrap();

	console.log(res);
};
