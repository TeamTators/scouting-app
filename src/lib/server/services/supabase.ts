import { createClient } from '@supabase/supabase-js';
import { config } from '../utils/env';
import type { Database } from '$lib/types/supabase';

export default createClient<Database>(
	`${config.supabase.protocol}://${config.supabase.ip}:${config.supabase.port}`,
	config.supabase.anon_key,
)