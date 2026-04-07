import fs from 'fs';
import path from 'path';

export type SupabaseAuthKeys = {
	public_key: string;
	secret_key: string;
};

/**
 * Parse Supabase CLI startup output and extract authentication keys.
 */
export const parseSupabaseStartLog = (contents: string): SupabaseAuthKeys => {
	const sep = '[|│]';
	const publishableMatch = contents.match(
		new RegExp(`${sep}\\s*Publishable\\s*${sep}\\s*([^\\n\\r|│]+?)\\s*${sep}`)
	);
	const secretMatch = contents.match(
		new RegExp(`${sep}\\s*Secret\\s*${sep}\\s*([^\\n\\r|│]+?)\\s*${sep}`)
	);

	const publicKey = publishableMatch?.[1]?.trim();
	const secretKey = secretMatch?.[1]?.trim();

	if (!publicKey || !secretKey) {
		throw new Error(
			'Could not parse authentication keys from log. Ensure the log includes the "Authentication Keys" table with Publishable and Secret rows.'
		);
	}

	return {
		public_key: publicKey,
		secret_key: secretKey
	};
};

export default () => {
	const logPath = 'supabase/sb-start.log';
	const absolutePath = path.isAbsolute(logPath) ? logPath : path.join(process.cwd(), logPath);

	if (!fs.existsSync(absolutePath)) {
		throw new Error(`Log file not found: ${absolutePath}`);
	}

	const contents = fs.readFileSync(absolutePath, 'utf8');
	return parseSupabaseStartLog(contents);
};