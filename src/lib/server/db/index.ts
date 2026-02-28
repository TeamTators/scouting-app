import { createClient } from '@supabase/supabase-js';
import { config } from '../utils/env';

export default createClient(
	config.supabase.url,
	config.supabase.anon_key,
)