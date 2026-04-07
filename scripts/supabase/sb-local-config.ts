import sbParseLog from "./sb-parse-log";
import path from 'path';
import fs from 'fs/promises';
import { parseJSON } from '../../src/lib/server/utils/files';
import z from "zod";

export default async () => {
    const configPath = path.join(process.cwd(), process.env.CONFIG_PATH || 'config.json');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = parseJSON(await fs.readFile(configPath, 'utf-8'), z.unknown()).unwrap() as any;

    if (!config.supabase) {
        throw new Error('Supabase configuration not found in config.json');
    }

    const parsed = sbParseLog();

    config.supabase.secret_key = parsed.authentication_keys_secret;
    config.supabase.public_key = parsed.authentication_keys_publishable;
    config.supabase.tenant_id = '';
    config.supabase.pg_pass = 'postgres';
    config.supabase.domain = parsed.apis_project_url.replace(/^https?:\/\//, '');
    config.supabase.port = 54321;
    config.supabase.protocol = 'http';
    config.supabase.db_port = 54322;
    config.supabase.sb_pass = '';
    config.supabase.local_ip = '127.0.0.1';

    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
};