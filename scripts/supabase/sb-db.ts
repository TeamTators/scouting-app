import { runTask } from '../../src/lib/server/utils/task';
import env from '../../src/lib/server/utils/env';

export default async (...args: string[]) => {
	const res = await runTask('npx', 'supabase', ...args, '--db-url', env.SB_DB_URL).unwrap();

	console.log(res);
};
