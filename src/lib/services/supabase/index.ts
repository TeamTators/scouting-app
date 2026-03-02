import { schemaName } from '$lib/types/supabase-schema';
import { createClient } from '@supabase/supabase-js';
import { type DB } from '$lib/services/supabase/supastruct';

export default createClient<DB>(__APP_ENV__.supabase.url, __APP_ENV__.supabase.anon_key, {
	db: {
		schema: schemaName
	}
});
