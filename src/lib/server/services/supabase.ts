import { createClient } from '@supabase/supabase-js';
import { str } from '../utils/env';
import { type SchemaName } from '../../types/supabase-schema';
import { type DB } from '../../types/supabase';

export const sb = {
	studio_url: str('SB_STUDIO_URL', true),
	mailpit_url: str('SB_MAILPIT_URL', true),
	mcp_url: str('SB_MCP_URL', true),
	project_url: str('SB_PROJECT_URL', true),
	db_url: str('SB_DB_URL', true),
	public_key: str('SB_PUBLIC_KEY', true),
	secret_key: str('SB_SECRET_KEY', true),
	storage_access_key: str('SB_STORAGE_ACCESS_KEY', true),
	storage_secret_key: str('SB_STORAGE_SECRET_KEY', true),
	region: str('SB_REGION', true),

	schema: str('SB_SCHEMA', true),
	public_url: str('SB_PUBLIC_URL', true),
	tenant_id: str('SB_TENANT_ID', false) || '',
	postgres_password: str('SB_POSTGRES_PASSWORD', true)
} as const;

export default createClient<DB>(sb.project_url, sb.secret_key, {
	db: {
		schema: sb.schema as SchemaName
	}
});
