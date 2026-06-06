import env from '../../src/lib/server/utils/env';
import sbDb from './sb-db';

export default async (...args: string[]) => {
	const schemas = Array.from(
		new Set([
			...env.SB_SCHEMAS,
			'realtime',
		])
	);

	await sbDb(
		'db',
		'pull',
		'--schema',
		schemas.join(','),
		...args
	);
};