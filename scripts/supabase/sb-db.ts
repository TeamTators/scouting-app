import { runTask } from '../../src/lib/server/utils/task';
import { dbUrl } from '../../src/lib/server/services/supabase';

export default async (...args: string[]) => {
	const res = await runTask('npx', 'supabase', ...args, '--db-url', dbUrl).unwrap();

	console.log(res);
};
