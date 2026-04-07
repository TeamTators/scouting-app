import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';
config();

export default (...args: string[]) => {
	let tenant_id = '',
		pg_pass = '',
		public_key = '',
		domain = '',
		secret_key = '',
		sb_pass = '',
		local_ip = '';

	for (const arg of args) {
		const [key, value] = arg.split('=');
		switch (key) {
			case 'tenant_id':
				tenant_id = value;
				break;
			case 'pg_pass':
				pg_pass = value;
				break;
			case 'public_key':
				public_key = value;
				break;
			case 'domain':
				domain = value;
				break;
			case 'secret_key':
				secret_key = value;
				break;
			case 'sb_pass':
				sb_pass = value;
				break;
			case 'local_ip':
				local_ip = value;
				break;
		}
	}

	for (const [key, value] of Object.entries({
		public_key: public_key,
		domain,
		secret_key: secret_key,
		sb_pass,
		local_ip
	})) {
		if (value === '') {
			throw new Error(
				`Missing value for ${key}. Please provide a value before running this script.`
			);
		}
	}

	const force = args.includes('--force') || args.includes('-f');
	if (!force && fs.existsSync(path.join(process.cwd(), process.env.CONFIG_PATH || 'config.json'))) {
		throw new Error('config.json already exists. Please delete it before running this script.');
	}

	const json = JSON.parse(
		fs.readFileSync(path.join(process.cwd(), 'config.example.json'), 'utf-8')
	);

	json.supabase.tenant_id = tenant_id || json.supabase.tenant_id;
	json.supabase.pg_pass = pg_pass || json.supabase.pg_pass;
	json.supabase.public_key = public_key || json.supabase.public_key;
	json.supabase.domain = domain || json.supabase.domain;
	json.supabase.secret_key = secret_key || json.supabase.secret_key;
	json.supabase.sb_pass = sb_pass || json.supabase.sb_pass;
	json.supabase.local_ip = local_ip || json.supabase.local_ip;

	fs.writeFileSync(
		path.join(process.cwd(), process.env.CONFIG_PATH || 'config.json'),
		JSON.stringify(json, null, 4)
	);
};
