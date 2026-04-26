import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import env from './src/lib/server/utils/env';

const isTest = Boolean(process.env.VITEST);

export default defineConfig({
	optimizeDeps: {
		include: ['ts-utils/**', 'drizzle-struct/**']
	},
	plugins: [sveltekit()],
	resolve: isTest
		? {
				conditions: ['browser', 'svelte', 'import', 'default']
			}
		: undefined,

	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		watch: process.argv.includes('watch'),
		environment: 'jsdom'
	},
	ssr: {
		noExternal: ['node-html-parser']
	},
	server: {
		port: env.PORT,
		host: '0.0.0.0',
		allowedHosts: ['dev.tsaxking.com'],
		watch: {
			ignored: [
				'**/node_modules/**',
				'**/.git/**',
				'**/dist/**',
				'**/build/**',
				'**/out/**',
				'**/coverage/**',
				'docs/**',
				'**/public/**',
				'**/.svelte-kit/**'
			]
		}
	},
	define: {
		__APP_ENV__: JSON.stringify({
			environment: env.ENVIRONMENT,
			name: env.APP_NAME,
			indexed_db: env.INDEXED_DB_ENABLED,
			struct_cache: env.STRUCT_CACHE_ENABLED,
			supabase: {
				url: env.SB_PUBLIC_URL,
				public_key: env.SB_PUBLIC_KEY,
				s3_access_key: env.SB_STORAGE_ACCESS_KEY
			}
		})
	}
});
