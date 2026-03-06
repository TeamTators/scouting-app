import fs from 'fs/promises';
import path from 'path';
import { config } from '../src/lib/server/utils/env';

export default async (schema: string) => {
    const validChars = /[a-z_]+$/;
    if (!validChars.test(schema)) {
        throw new Error('Invalid schema name. Only lowercase letters and underscores are allowed.');
    }

    const notAllowed = [
        'dashboard_user',
        'pgbouncer',
        'anon',
        'authenticated',
        'service_role',
        'postgres',
        'supabase_auth_admin',
        'supabase_read_only_user',
        'supabase_realtime_admin',
        'supabase_replication_admin',
        'supabase_storage_admin',
    ];

    if (notAllowed.includes(schema)) {
        throw new Error(`The schema name "${schema}" is reserved and cannot be used.`);
    }


    const currentSchema = config.supabase.schema;
    const filesToEdit = [
        './src/lib/server/supabase.ts',
        './src/lib/server/supabase-zod.ts',
        './src/lib/server/supabase-schema.ts',
        './supabase/roles.sql',
        './supabase/schema.sql',
        './config.json',
    ];
    const date = Date.now();

    // backup files
    for (const file of filesToEdit) {
        const filePath = path.resolve(process.cwd(), file);
        const name = path.basename(filePath);
        const ext = path.extname(filePath);
        const backupPath = path.join(process.cwd(), 'private', 'backups', `${date}_${name}.${ext}.backup`);
        await fs.mkdir(path.dirname(backupPath), { recursive: true });
        await fs.copyFile(filePath, backupPath);
        console.log(`Backed up ${file} to ${backupPath}`);
        
        const contents = await fs.readFile(filePath, 'utf-8');
        const updatedContents = contents.replace(new RegExp(currentSchema, 'g'), schema);
        await fs.writeFile(filePath, updatedContents, 'utf-8');
        console.log(`Updated ${file} with new schema name: ${schema}`);
    }
};