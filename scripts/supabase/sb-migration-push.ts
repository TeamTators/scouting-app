import { runTask } from '../../src/lib/server/utils/task';
import { dbUrl } from '../../src/lib/server/services/supabase';

export default async () => {
	const res = await runTask('npx', 'supabase', 'db', 'push', '--db-url', dbUrl).unwrap();

	console.log(res);
};
