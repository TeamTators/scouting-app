// See https://svelte.dev/docs/kit/types#app.d.ts

import type { Account } from '$lib/model/account';
import type { createServerClient } from '@supabase/ssr';
import type { Session } from '@supabase/supabase-js';
import type { ResultPromise } from 'ts-utils';
import type { DB } from '$lib/services/supabase/supastruct';

// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			start: number;
			supabase: ReturnType<typeof createServerClient<DB>>;
			getSession: () => ResultPromise<{
				user: Session['user'] | null;
				session: Session | null;
				account: Account | null;
			}>;
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
