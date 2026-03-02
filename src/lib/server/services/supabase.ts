import { createClient } from '@supabase/supabase-js';
import { config } from '../utils/env';
import { schemaName } from '$lib/types/supabase-schema';
import { type DB } from '$lib/services/supabase/supastruct';

export default createClient<DB>(
	`${config.supabase.protocol}://${config.supabase.domain}:${config.supabase.port}`,
	config.supabase.service_role_key,
	{
		db: {
			schema: schemaName
		}
	}
);
