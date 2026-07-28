import { createClient } from '@supabase/supabase-js';
import { type Database } from '$lib/types/supabase';

export default Object.assign(
	createClient<Database>(__APP_ENV__.supabase.url, __APP_ENV__.supabase.public_key, {
		auth: {
			persistSession: true,
			autoRefreshToken: true
		}
	}),
	{
		serviceRole: false
	}
);
