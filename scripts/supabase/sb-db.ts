import { runTask } from '../../src/lib/server/utils/task';
import { sb } from '../../src/lib/server/services/supabase';

export default async (...args: string[]) => {
	const res = await runTask('npx', 'supabase', ...args, '--db-url', sb.db_url).unwrap();

	console.log(res);
};
