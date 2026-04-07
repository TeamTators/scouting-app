import { createClient } from '@supabase/supabase-js';
import { config } from '../utils/env';
import { schemaName } from '$lib/types/supabase-schema';
import { type DB } from '$lib/services/supabase/supastruct';

export default createClient<DB>(
	`http://${config.supabase.local_ip}:${config.supabase.port}`,
	config.supabase.secret_key,
	{
		db: {
			schema: schemaName
		}
	}
);

export const dbUrl = (() => {
	const name = 'postgres' + (config.supabase.tenant_id ? `.${config.supabase.tenant_id}` : '');
	return `postgres://${name}:${config.supabase.pg_pass}@${config.supabase.local_ip}:${config.supabase.db_port}/postgres`;
})();
