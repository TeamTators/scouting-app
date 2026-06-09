import { createClient } from '@supabase/supabase-js';
import { type Database } from '$lib/types/supabase';

export default createClient<Database>(
	__APP_ENV__.supabase.url,
	__APP_ENV__.supabase.public_key,
	{}
);
