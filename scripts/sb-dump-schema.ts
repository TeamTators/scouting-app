import { runTask } from '../src/lib/server/utils/task';
import { config } from '../src/lib/server/utils/env';

export default async () => {
	return runTask(
		`PGPASSWORD=${config.supabase.pg_pass}`,
		'pg_dump',
		'-h',
		config.supabase.local_ip,
		'-p',
		config.supabase.db_port,
		'-U',
		`postgres.${config.supabase.tenant_id}`,
		'-d',
		'postgres',
		'--schema-only',
		'--schema',
		config.supabase.schema,
		'>',
		'supabase/schema.sql'
	);
};
