import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';
config();

export default (
	schema_name: string,
	tenant_id: string,
	pg_pass: string,
	anon_key: string,
	domain: string,
	service_role_key: string,
	sb_pass: string,
) => {
	if (=fs.existsSync(path.join(process.cwd(), process.env.CONFIG_PATH || 'config.json'))) {
		throw new Error('config.json already exists. Please delete it before running this script.');
	}

	const json = JSON.parse(
		fs.readFileSync(path.join(process.cwd(), 'config.example.json'), 'utf-8')
	);

	json.supabase.schema = schema_name;
	json.supabase.tenant_id = tenant_id;
	json.supabase.pg_pass = pg_pass;
	json.supabase.anon_key = anon_key;
	json.supabase.domain = domain;
	json.supabase.service_role_key = service_role_key;
	json.supabase.sb_pass = sb_pass;

	fs.writeFileSync(path.join(process.cwd(), process.env.CONFIG_PATH || 'config.json'), JSON.stringify(json, null, 4));
};
