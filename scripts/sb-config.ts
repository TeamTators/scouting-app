import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';
config();

export default (
	...args: string[]
) => {
	let schema_name = '',
		tenant_id = '',
		pg_pass = '',
		anon_key = '',
		domain = '',
		service_role_key = '',
		sb_pass = '';

	for (const arg of args) {
		const [key, value] = arg.split('=');
		switch (key) {
			case 'schema_name':
				schema_name = value;
				break;
			case 'tenant_id':
				tenant_id = value;
				break;
			case 'pg_pass':
				pg_pass = value;
				break;
			case 'anon_key':
				anon_key = value;
				break;
			case 'domain':
				domain = value;
				break;
			case 'service_role_key':
				service_role_key = value;
				break;
			case 'sb_pass':
				sb_pass = value;
				break;
		}
	}

	for (const [key, value] of Object.entries({schema_name, tenant_id, pg_pass, anon_key, domain, service_role_key, sb_pass})) {
		if (value === '') {
			throw new Error(`Missing value for ${key}. Please provide a value before running this script.`);
		}
	}

	const force = args.includes('--force') || args.includes('-f');
	if (!force && fs.existsSync(path.join(process.cwd(), process.env.CONFIG_PATH || 'config.json'))) {
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
