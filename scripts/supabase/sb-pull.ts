import env from '../../src/lib/server/utils/env';
import sbDb from './sb-db';

export default async (...args: string[]) => {
	const schemas = Array.from(
		new Set([
			...env.SB_SCHEMAS,
			'realtime',
		])
	);

	try {
		await sbDb(
			'db',
			'pull',
			'--schema',
			schemas.join(','),
			...args
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (!message.includes('No schema changes found')) {
			throw error;
		}
	}
};