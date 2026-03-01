import { createClient } from '@supabase/supabase-js';
import { config } from '../src/lib/server/utils/env';

export default async () => {
    const client = createClient(
        config.supabase.url,
        config.supabase.anon_key
    );
    console.log(client);

    const { data, error } = await client.from('todos').select('*');
    console.log(data, error);
};