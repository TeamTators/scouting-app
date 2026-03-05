import { runTask } from '../src/lib/server/utils/task';
import { config } from '../src/lib/server/utils/env';

export default async () => {
    return await runTask(
        `PGPASSWORD=${config.supabase.password}`,
        'pg_dumpall',
        '--roles-only',
        '-h', config.supabase.local_ip,
        '-p', '5432',
        '-U', `postgres.${config.supabase.tenant_id}`,
        '>', 'supabase/roles.sql',
    )
};