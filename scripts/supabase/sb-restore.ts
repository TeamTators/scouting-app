/* eslint-disable @typescript-eslint/no-explicit-any */
import AdmZip from 'adm-zip';
import supabase from '../../src/lib/server/services/supabase';
import env from '../../src/lib/server/utils/env';
import path from 'path';
import fs from 'fs';
import * as csv from 'csv';
import cli_select from 'cli-select';
import export_zip from './sb-backup';

const order = [
    'auth.users',
    'core.profile',
    'core.role',
    'core.role_account',
    'core.account_notification',
];

export default async (zip_path: string) => {
    const export_dir = path.resolve(process.cwd(), 'backups');

    if (!zip_path) {
        const files = await fs.promises.readdir(export_dir);
        const zip_files = files
            .filter((file) => file.startsWith('supabase-export-') && file.endsWith('.zip'))
            .sort();
        if (zip_files.length === 0) {
            throw new Error(`No backup zip files found in ${export_dir}`);
        }


        // select a zip file
        const res = await cli_select({
            values: zip_files
        });
        zip_path = path.join(export_dir, res.value);
    }
    if (!zip_path.endsWith('.zip')) zip_path += '.zip';
    if (!zip_path.startsWith('/')) zip_path = path.resolve(process.cwd(), 'backups', zip_path);
    await export_zip(); // create a backup
    let schemas = env.SB_SCHEMAS.slice();
    schemas.push('auth', 'public');
    schemas = Array.from(new Set(schemas));

    const { data, error } = await supabase.rpc('get_schemas_and_tables');

    if (error) throw new Error(`Error fetching schemas and tables: ${error.message}`);
    if (!data) throw new Error('No data returned from get_schemas_and_tables');

    const schema_tables: Record<string, string[]> = {};

    for (const row of data) {
        if (!schema_tables[row.schema_name]) {
            schema_tables[row.schema_name] = [];
        }
        schema_tables[row.schema_name].push(row.table_name);
    }

    // Validate order list against available database tables
    for (const table of order) {
        const [schema, table_name] = table.split('.');
        if (!schema_tables[schema]) {
            schema_tables[schema] = [];
        }
        if (!schema_tables[schema].includes(table_name)) {
            throw new Error(`Table ${table} not found in schema ${schema}`);
        }
    }

    

    const zip = new AdmZip(zip_path);
    const tempExtractDir = path.join(export_dir, `temp-restore-${Date.now()}`);
    await fs.promises.mkdir(tempExtractDir, { recursive: true });
    
    zip.extractAllTo(tempExtractDir, true);

    // Import/restore data strictly matching the sequence defined in `order`
    for (const tableKey of order) {
        const [schema_name, table_name] = tableKey.split('.');
        // delete all data from the table before restoring
        if (schema_name === 'auth' && table_name === 'users') {
            // Special handling for auth.users table
            const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
            if (usersError) throw new Error(`Error fetching users: ${usersError.message}`);
            for (const user of users.users) {
                const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
                if (deleteError) throw new Error(`Error deleting user ${user.id}: ${deleteError.message}`);
            }
        } else {
            const { error: deleteError } = await supabase
                .schema(schema_name as any)
                .from(table_name as any)
                .delete()
                .neq('id', crypto.randomUUID()); // Delete all rows (assuming 'id' is a primary key)
            if (deleteError) throw new Error(`Error deleting data from ${tableKey}: ${deleteError.message}`);
        }
        
        // Handle auth.users vs standard table CSV filenames mapping
        const csvFileName = tableKey === 'auth.users' ? 'users.csv' : `${schema_name}-${table_name}.csv`;
        const csvFilePath = path.join(tempExtractDir, csvFileName);

        if (!fs.existsSync(csvFilePath)) {
            console.warn(`Warning: Backup file for ${tableKey} not found in archive. Skipping.`);
            continue;
        }

        console.log(`Restoring data into ${tableKey}...`);

        const rows: any[] = [];
        const parser = fs.createReadStream(csvFilePath).pipe(csv.parse({ columns: true, relax_column_count: true }));

        for await (const record of parser) {
            rows.push(record);
        }

        if (rows.length === 0) {
            console.log(`Table ${tableKey} has no records to restore.`);
            continue;
        }

        // Batch inserts/upserts to handle large payloads efficiently (e.g., batches of 500)
        const batchSize = 500;
        for (let i = 0; i < rows.length; i += batchSize) {
            const batch = rows.slice(i, i + batchSize);

            if (tableKey === 'auth.users') {
                // Special handling if restoring auth users via admin API or custom upsert routing depending on setup
                for (const user of batch) {
                    const { error: userError } = await supabase.auth.admin.createUser({
                        email: user.email,
                        password: user.encrypted_password || crypto.randomUUID(), // fallback or handle raw import safely
                        email_confirm: true,
                        user_metadata: user.raw_user_meta_data ? JSON.parse(user.raw_user_meta_data) : {}
                    });
                    if (userError && !userError.message.includes('already registered')) {
                        console.error(`Failed to restore user ${user.email}: ${userError.message}`);
                    }
                }
            } else {
                const { error: insertError } = await supabase
                    .schema(schema_name as any)
                    .from(table_name as any)
                    .upsert(batch, { onConflict: 'id' }); // Adjust conflict target column if primary key differs

                if (insertError) {
                    throw new Error(`Error restoring data into ${tableKey}: ${insertError.message}`);
                }
            }
        }
    }

    // Cleanup extracted temp files
    await fs.promises.rm(tempExtractDir, { recursive: true, force: true });
    console.log('Database restore completed successfully.');
};