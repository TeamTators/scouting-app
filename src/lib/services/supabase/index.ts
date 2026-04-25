import { schemaName } from '$lib/types/supabase-schema';
import { createClient } from '@supabase/supabase-js';
import { type DB } from '$lib/types/supabase';

export default createClient<DB>(__APP_ENV__.supabase.url, __APP_ENV__.supabase.public_key, {
	db: {
		schema: schemaName
	}
});
