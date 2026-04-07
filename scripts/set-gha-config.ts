import fs from 'fs';
import path from 'path';

export default (
	schema_name: string,
	tenant_id: string,
	pg_pass: string,
	public_key: string,
	domain: string,
	secret_key: string,
	sb_pass: string
) => {
	if (fs.existsSync(path.join(process.cwd(), 'config.json'))) {
		throw new Error('config.json already exists. Please delete it before running this script.');
	}

	const json = JSON.parse(
		fs.readFileSync(path.join(process.cwd(), 'config.example.json'), 'utf-8')
	);

	json.supabase.schema = schema_name;
	json.supabase.tenant_id = tenant_id;
	json.supabase.pg_pass = pg_pass;
	json.supabase.public_key = public_key;
	json.supabase.domain = domain;
	json.supabase.secret_key = secret_key;
	json.supabase.sb_pass = sb_pass;

	fs.writeFileSync(path.join(process.cwd(), 'config.json'), JSON.stringify(json, null, 4));
};
