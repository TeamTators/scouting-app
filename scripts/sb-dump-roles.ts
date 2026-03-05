import { runTask } from '../src/lib/server/utils/task';
import { config } from '../src/lib/server/utils/env';

export default async () => {
	return await runTask(
		`PGPASSWORD=${config.supabase.pg_pass}`,
		'pg_dumpall',
		'--roles-only',
		'-h',
		config.supabase.local_ip,
		'-p',
		config.supabase.db_port,
		'-U',
		`postgres.${config.supabase.tenant_id}`,
		'>',
		'supabase/roles.sql'
	);
};
