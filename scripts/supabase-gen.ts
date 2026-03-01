import { runTask } from '../src/lib/server/utils/task';
import { config } from '../src/lib/server/utils/env';

export default async () => {
    await runTask(
        'npx', 'supabase', 'gen', 'types', 'typescript', 
        '--db-url', `postgres://postgres.${config.supabase.tenant_id}:${config.supabase.password}@${config.supabase.ip}:5432/postgres`,
        '--schema', config.supabase.schema,
        '>', 'src/lib/types/supabase.ts'
    ).unwrap();

    // pull db schema and rls
    await runTask(
        'npx', 'supabase', 'pull',
        '--db-url', `postgres://postgres.${config.supabase.tenant_id}:${config.supabase.password}@${config.supabase.ip}:5432/postgres`,
        '--schema', config.supabase.schema,
    );
};