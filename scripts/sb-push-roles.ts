import { runTask } from '../src/lib/server/utils/task';
import { config } from '../src/lib/server/utils/env';

export default async () => {
    return runTask(
        `PGPASSWORD=${config.supabase.password}`,
        'psql',
        '-h', config.supabase.local_ip,
        '-p', '5432',
        '-U', `postgres.${config.supabase.tenant_id}`,
        '-d', 'postgres',
        '-W', `"${config.supabase.password}"`,
        '-f', 'supabase/roles.sql',
    );
};