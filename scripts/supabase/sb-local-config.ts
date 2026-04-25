import sbParseLog from './sb-parse-log';
import { set } from '../../src/lib/server/utils/env';

export default async () => {
	const parsed = sbParseLog();

	set({
		SB_STUDIO_URL: parsed.development_tools_studio,
		SB_MAILPIT_URL: parsed.development_tools_mailpit,
		SB_MCP_URL: parsed.development_tools_mcp,
		SB_PROJECT_URL: parsed.apis_project_url,
		SB_DB_URL: parsed.database_url,
		SB_PUBLIC_KEY: parsed.authentication_keys_publishable,
		SB_SECRET_KEY: parsed.authentication_keys_secret,
		SB_STORAGE_ACCESS_KEY: parsed.storage_s3_access_key,
		SB_STORAGE_SECRET_KEY: parsed.storage_s3_secret_key,
		SB_REGION: parsed.storage_s3_region,
		SB_PUBLIC_URL: parsed.apis_project_url,
		SB_POSTGRES_PASSWORD: 'postgres',
		SB_TENANT_ID: '',
	}).unwrap();
};
