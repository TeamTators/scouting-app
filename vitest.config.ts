/// <reference types="vitest" />
import { mdsvex } from 'mdsvex';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
// import { playwright } from '@vitest/browser-playwright';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
// import path from 'node:path';
// import { fileURLToPath } from 'node:url';
// import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { email } from '@svelte-plugin/email/vite';
import env from './src/lib/server/utils/env.ts';

// const dirname =
// 	typeof import.meta.dirname !== 'undefined'
// 		? import.meta.dirname
// 		: path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
	resolve: {
		conditions: ['browser']
	},
	plugins: [
		email({
			dir: 'src/lib/emails'
		}),
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true,
				experimental: {
					async: true
				}
			},
			adapter: adapter(),
			preprocess: [
				mdsvex({
					extensions: ['.svx', '.md']
				})
			],
			extensions: ['.svelte', '.svx', '.md'],
			experimental: {
				remoteFunctions: true
			},
			alias: {
				$lib: 'src/lib',
				'#lib': 'src/lib'
			}
		})
	],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		watch: process.argv.includes('watch'),
		environment: 'jsdom'
		// expect: {
		// 	requireAssertions: true
		// },
		// projects: [
		// 	{
		// 		extends: './vite.config.ts',
		// 		test: {
		// 			name: 'client',
		// 			browser: {
		// 				enabled: true,
		// 				provider: playwright(),
		// 				instances: [
		// 					{
		// 						browser: 'chromium',
		// 						headless: true
		// 					}
		// 				]
		// 			},
		// 			include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
		// 			exclude: ['src/lib/server/**']
		// 		}
		// 	},
		// 	{
		// 		extends: './vite.config.ts',
		// 		test: {
		// 			name: 'server',
		// 			environment: 'node',
		// 			include: ['src/**/*.{test,spec}.{js,ts}'],
		// 			exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
		// 		}
		// 	},
		// 	{
		// 		extends: true,
		// 		plugins: [
		// 			// The plugin will run tests for the stories defined in your Storybook config
		// 			// See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
		// 			storybookTest({
		// 				configDir: path.join(dirname, '.storybook')
		// 			})
		// 		],
		// 		test: {
		// 			name: 'storybook',
		// 			browser: {
		// 				enabled: true,
		// 				headless: true,
		// 				provider: playwright({}),
		// 				instances: [
		// 					{
		// 						browser: 'chromium'
		// 					}
		// 				]
		// 			}
		// 		}
		// 	}
		// ]
	},
	ssr: {
		noExternal: ['node-html-parser', 'ts-utils', 'colors']
	},
	server: {
		port: env.PORT,
		host: '0.0.0.0',
		allowedHosts: env.ALLOWED_HOSTS,
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
			indexed_db: {
				enabled: env.INDEXED_DB_ENABLED,
				debug: env.INDEXED_DB_DEBUG,
				name: env.INDEXED_DB_NAME,
				debounce_interval_ms: env.INDEXED_DB_DEBOUNCE_INTERVAL_MS
			},
			struct_cache: env.STRUCT_CACHE_ENABLED,
			supabase: {
				url: env.SB_PUBLIC_URL,
				public_key: env.SB_PUBLIC_KEY,
				s3_access_key: env.SB_STORAGE_ACCESS_KEY
			}
		})
	}
	// environments:
});
