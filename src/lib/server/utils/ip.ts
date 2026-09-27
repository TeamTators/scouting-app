/**
 * @fileoverview Public IP lookup helper for server-side network diagnostics.
 *
 * @example
 * import { getPublicIp } from '$lib/server/utils/ip';
 * const ip = await getPublicIp().unwrap();
 */
import { attemptAsync } from 'ts-utils';
import { z } from 'zod';

/**
 * Resolves the public IP address for the current server via an external IP service.
 *
 * @returns {ReturnType<typeof attemptAsync<string>>} Result-wrapped public IPv4 address.
 */
export const getPublicIp = () => {
	return attemptAsync(async () => {
		const res = await fetch('https://api.ipify.org?format=json');
		const data = z.object({ ip: z.string() }).parse(await res.json());
		return data.ip;
	});
};
