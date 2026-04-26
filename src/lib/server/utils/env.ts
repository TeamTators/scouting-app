import { arr, bool, num, str, union } from './env-utils';

export default {
	ENVIRONMENT: union(
		'ENVIRONMENT',
		['dev', 'staging', 'prod'],
		true,
		'The current environment (development, staging, production)'
	),

	SITE_URL: str(
		'SITE_URL',
		true,
		'The base URL of your website. Used as an allow-list for redirects and for constructing URLs used in emails.'
	),
	PROTOCOL: union(
		'PROTOCOL',
		['http', 'https'],
		true,
		'The protocol to use for the SITE_URL (http or https)'
	),
	PORT: num('PORT', true, 'The port to run the server on'),
	APP_NAME: str('APP_NAME', true, 'Application name to use as sender name in emails'),

	SB_PUBLIC_URL: str('SB_PUBLIC_URL', true, 'Public Supabase URL'),
	SB_PROJECT_URL: str(
		'SB_PROJECT_URL',
		true,
		'Supabase Project URL for testing server-side Supabase operations'
	),
	SB_PUBLIC_KEY: str('SB_PUBLIC_KEY', true, 'Public Supabase API Key'),
	SB_STUDIO_URL: str('SB_STUDIO_URL', true, 'Supabase Studio URL'),
	SB_MAILPIT_URL: str('SB_MAILPIT_URL', true, 'Mailpit URL for testing email sending'),
	SB_MCP_URL: str('SB_MCP_URL', true, 'Supabase MCP URL for testing file uploads'),
	SB_DB_URL: str('SB_DB_URL', true, 'Supabase Database URL for testing database connection'),
	SB_SECRET_KEY: str(
		'SB_SECRET_KEY',
		true,
		'Supabase Secret API Key for testing server-side Supabase operations'
	),
	SB_STORAGE_ACCESS_KEY: str(
		'SB_STORAGE_ACCESS_KEY',
		true,
		'Supabase Storage Access Key for testing file uploads'
	),
	SB_STORAGE_SECRET_KEY: str(
		'SB_STORAGE_SECRET_KEY',
		true,
		'Supabase Storage Secret Key for testing file uploads'
	),
	SB_REGION: str('SB_REGION', true, 'Supabase Region for testing file uploads'),
	SB_SCHEMA: str('SB_SCHEMA', true, 'Supabase Schema for testing database connection'),
	SB_POSTGRES_PASSWORD: str(
		'SB_POSTGRES_PASSWORD',
		true,
		'Supabase Postgres Password for testing database connection'
	),
	SB_STORAGE_ENDPOINT: str(
		'SB_STORAGE_ENDPOINT',
		true,
		'Supabase Storage Endpoint for testing file uploads'
	),

	SMTP_HOST: str('SMTP_HOST', true, 'SMTP host for sending emails'),
	SMTP_USER: str('SMTP_USER', true, 'SMTP user for sending emails'),
	SMTP_PASS: str('SMTP_PASS', true, 'SMTP password for sending emails'),
	SMTP_ADMIN_EMAIL: str('SMTP_ADMIN_EMAIL', true, 'Admin email to receive notifications'),

	OAUTH2_PROVIDER: str('OAUTH2_PROVIDER', true, 'OAuth2 provider for testing authentication'),
	OAUTH2_CLIENT_ID: str('OAUTH2_CLIENT_ID', true, 'OAuth2 client ID for testing authentication'),
	OAUTH2_CLIENT_SECRET: str(
		'OAUTH2_CLIENT_SECRET',
		true,
		'OAuth2 client secret for testing authentication'
	),

	FINGERPRINT_SECRET: str(
		'FINGERPRINT_SECRET',
		true,
		'Secret key for generating fingerprint tokens'
	),

	INDEXED_DB_ENABLED: bool(
		'INDEXED_DB_ENABLED',
		true,
		'Whether to enable IndexedDB for testing purposes'
	),
	INDEXED_DB_NAME: str(
		'INDEXED_DB_NAME',
		true,
		'The name of the IndexedDB database to use for testing'
	),
	INDEXED_DB_VERSION: num(
		'INDEXED_DB_VERSION',
		true,
		'The version of the IndexedDB database to use for testing'
	),
	INDEXED_DB_DEBUG: bool(
		'INDEXED_DB_DEBUG',
		false,
		'Whether to enable debug logging for IndexedDB operations'
	),
	INDEXED_DB_DEBOUNCE_INTERVAL_MS: num(
		'INDEXED_DB_DEBOUNCE_INTERVAL_MS',
		true,
		'The debounce interval in milliseconds for IndexedDB operations'
	),

	STRUCT_CACHE_ENABLED: bool(
		'STRUCT_CACHE_ENABLED',
		true,
		'Whether to enable caching for Struct instances'
	),
	STRUCT_CACHE_DEBUG: bool(
		'STRUCT_CACHE_DEBUG',
		false,
		'Whether to enable debug logging for Struct caching operations'
	),

	NTP_ENABLED: bool('NTP_ENABLED', true, 'Whether to enable NTP synchronization'),
	NTP_SERVERS: arr(
		'NTP_SERVERS',
		'string',
		true,
		'Comma-separated list of NTP servers to use for synchronization'
	),

	ADMIN_ENABLED: bool('ADMIN_ENABLED', true, 'Whether to enable the admin interface'),
	ADMIN_USERNAME: str('ADMIN_USERNAME', true, 'Username for admin interface'),
	ADMIN_PASSWORD: str('ADMIN_PASSWORD', true, 'Password for admin interface'),
	ADMIN_EMAIL: str('ADMIN_EMAIL', true, 'Email for admin interface'),
	ADMIN_FIRST_NAME: str('ADMIN_FIRST_NAME', true, 'First name for admin interface'),
	ADMIN_LAST_NAME: str('ADMIN_LAST_NAME', true, 'Last name for admin interface'),

	LOGS_ENABLED: bool('LOGS_ENABLED', true, 'Whether to enable logging'),
	LOGS_OUTDIR: str('LOGS_OUTDIR', true, 'The directory to write logs to'),
	LOGS_LEVEL: arr(
		'LOGS_LEVEL',
		'string',
		true,
		'Comma-separated list of log levels to enable (error, warn, info, debug)'
	),

	REDIS_URL: str('REDIS_URL', true, 'Redis connection URL for caching and other Redis operations'),
	REDIS_NAME: str('REDIS_NAME', true, 'Name of the Redis instance for logging purposes'),

	SESSION_AUTO_SIGN_IN_ENABLED: bool(
		'SESSION_AUTO_SIGN_IN_ENABLED',
		true,
		'Whether to automatically sign in users on session restoration'
	),
	SESSION_AUTO_SIGN_IN_USER: str(
		'SESSION_AUTO_SIGN_IN_USER',
		true,
		'Email of the user to automatically sign in on session restoration'
	)
};
