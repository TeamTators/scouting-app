// See https://svelte.dev/docs/kit/types#app.d.ts

import type { createServerClient } from '@supabase/ssr';
import type { DB } from '$lib/types/supabase';
import { Session } from '$lib/server/model/session';
import type { Connection } from '$lib/server/services/sse';

// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			start: number;
			supabase: ReturnType<typeof createServerClient<DB>>;
			session: Session | null;
			sse: Connection | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	const __APP_ENV__: {
		environment: 'prod' | 'dev' | 'test' | 'staging';
		name: string;
		indexed_db: {
			enabled: boolean;
			db_name: string;
			version: number;
			debug: boolean;
			debounce_interval_ms: number;
		};
		struct_cache: {
			enabled: boolean;
			debug: boolean;
		};
		supabase: {
			url: string;
			public_key: string;
		};
	};
}

export {};
