import fs from 'fs';
import path from 'path';
import z from 'zod';

export type SupabaseStartParams = Record<string, string>;

const rowRegex = /^\s*[|│]\s*([^|│]+?)\s*[|│]\s*([^|│]+?)\s*[|│]\s*$/;
const sectionRegex = /^\s*[|│]\s*([^|│]+?)\s*[|│]\s*$/;

const normalizeKey = (key: string) =>
	key
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');

const normalizeSection = (section: string) =>
	normalizeKey(section.trim().replace(/^[^a-zA-Z0-9]+/, ''));

/**
 * Parse Supabase CLI startup output and extract all section parameters
 * as normalized variable-name key/value pairs.
 */
export const parseSupabaseStartLog = (contents: string) => {
	const params: Record<string, string> = {};

	let currentSection = '';
	for (const line of contents.split(/\r?\n/)) {
		const rowMatch = line.match(rowRegex);
		if (rowMatch) {
			const rawKey = rowMatch[1]?.trim();
			const rawValue = rowMatch[2]?.trim();
			if (!rawKey || !rawValue) continue;

			const sectionName = currentSection || 'global';
			const key = normalizeKey(rawKey);
			if (!key) continue;

			params[`${sectionName}_${key}`] = rawValue;
			continue;
		}

		const sectionMatch = line.match(sectionRegex);
		if (sectionMatch) {
			const normalizedSection = normalizeSection(sectionMatch[1] || '');
			if (normalizedSection) {
				currentSection = normalizedSection;
			}
		}
	}

	if (Object.keys(params).length === 0) {
		throw new Error('Could not parse any parameters from log.');
	}

	const zod = z.object({
		development_tools_studio: z.string(),
		development_tools_mailpit: z.string(),
		development_tools_mcp: z.string(),
		apis_project_url: z.string(),
		apis_rest: z.string(),
		apis_graphql: z.string(),
		apis_edge_functions: z.string(),
		database_url: z.string(),
		authentication_keys_publishable: z.string(),
		authentication_keys_secret: z.string(),
		storage_s3_url: z.string(),
		storage_s3_access_key: z.string(),
		storage_s3_secret_key: z.string(),
		storage_s3_region: z.string()
	});

	return zod.parse(params);
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
