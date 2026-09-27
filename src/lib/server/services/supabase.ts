/**
 * @fileoverview Shared server-side Supabase client instance for the app.
 *
 * This module centralizes the server-side client wiring so routes and server utilities
 * can share a single authenticated `serviceRole` client without recreating it per call.
 *
 * @example
 * import supabase from '$lib/server/services/supabase';
 * const { data } = await supabase.auth.getUser();
 */
import { createClient } from '@supabase/supabase-js';
import { type Database } from '../../types/supabase';
import env from '../utils/env';

/**
 * Runtime type for the server-side Supabase client with privileged access enabled.
 */
type ServerSupabaseClient = ReturnType<typeof createClient<Database>> & {
	serviceRole: true;
};

/**
 * Cached singleton client used by the server runtime.
 */
let cachedClient: ServerSupabaseClient | null = null;

/**
 * Lazily creates and caches the server-side Supabase client.
 *
 * @returns {ServerSupabaseClient} The singleton Supabase client instance.
 */
const getClient = () => {
	if (cachedClient) return cachedClient;
	const skipValidation = process.env.SKIP_ENV_VALIDATION === '1';

	const projectUrl = (() => {
		if (!skipValidation) return env.SB_PROJECT_URL;
		try {
			new URL(env.SB_PROJECT_URL);
			return env.SB_PROJECT_URL;
		} catch {
			return 'http://localhost';
		}
	})();

	const secretKey = skipValidation && !env.SB_SECRET_KEY ? 'build' : env.SB_SECRET_KEY;

	cachedClient = Object.assign(createClient<Database>(projectUrl, secretKey, {}), {
		serviceRole: true as const
	});

	return cachedClient;
};

const supabase = new Proxy({} as ServerSupabaseClient, {
	get(_target, prop, receiver) {
		return Reflect.get(getClient(), prop, receiver);
	},
	set(_target, prop, value, receiver) {
		return Reflect.set(getClient(), prop, value, receiver);
	},
	has(_target, prop) {
		return Reflect.has(getClient(), prop);
	},
	ownKeys() {
		return Reflect.ownKeys(getClient());
	},
	getOwnPropertyDescriptor(_target, prop) {
		return Reflect.getOwnPropertyDescriptor(getClient(), prop);
	}
}) as ServerSupabaseClient;

export default supabase;
