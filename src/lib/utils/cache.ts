import { attemptAsync } from 'ts-utils';
import { browser } from '$app/env';
import { DexieTable } from '$lib/services/db/table';
import { z } from 'zod';

const Cache = DexieTable.get({
	name: 'fn_cache',
	schema: z.object({
		key: z.string(),
		value: z.unknown(),
		expires: z.number()
	})
});

export const cache_fn = <T>(fn: () => T, ttl: number) => {
	return attemptAsync<Awaited<T>>(async () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		if (!browser) return (await fn()) as any;
		const key = fn.toString();
		const [cached] = await Cache.get({ key }).unwrap();
		if (cached && cached.raw.expires > Date.now()) return cached.raw.value as Awaited<T>;
		try {
			const result = await fn();
			await Cache.new({
				key,
				value: result,
				expires: Date.now() + ttl,
				id: crypto.randomUUID(),
				created_at: new Date()
			});
			return result as Awaited<T>;
		} catch (error) {
			console.error('Cache function error:', error);
			if (cached) return cached.raw.value as Awaited<T>;
			throw error;
		}
	});
};
