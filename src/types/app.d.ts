// See https://svelte.dev/docs/kit/types#app.d.ts

import type { createServerClient } from '@supabase/ssr';
import type { DB } from '$lib/services/supabase/supastruct';
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
		struct_batching: {
			enabled: boolean;
			interval: number;
			timeout: number;
			limit: number;
			batch_size: number;
			debug: boolean;
		};
		sse: {
			debug: boolean;
			ping_interval_ms: number;
			state_report_threshold: number;
			do_report: boolean;
		};
		supabase: {
			url: string;
			anon_key: string;
		};
	};
}

export {};
