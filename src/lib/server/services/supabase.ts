import { createClient } from '@supabase/supabase-js';
import { type Database } from '../../types/supabase';
import env from '../utils/env';

export default createClient<Database>(env.SB_PROJECT_URL, env.SB_SECRET_KEY);
