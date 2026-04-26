import { createClient } from '@supabase/supabase-js';
import { type SchemaName } from '../../types/supabase-schema';
import { type DB } from '../../types/supabase';
import env from '../utils/env';

console.log('Loaded environment: ', env);

export default createClient<DB>(env.SB_PROJECT_URL, env.SB_SECRET_KEY, {
	db: {
		schema: env.SB_SCHEMA as SchemaName
	}
});
