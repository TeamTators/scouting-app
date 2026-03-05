import { runTask } from '../src/lib/server/utils/task';
import { config } from '../src/lib/server/utils/env';

export default async () => {
    return runTask(
        `PGPASSWORD=${config.supabase.password}`,
        'pg_dump',
        '-h', config.supabase.local_ip,
        '-p', '5432',
        '-U', `postgres.${config.supabase.tenant_id}`,
        '-d', 'postgres',
        '--schema-only',
        '--schema', config.supabase.schema,
        '>', 'supabase/schema.sql',
    )
};