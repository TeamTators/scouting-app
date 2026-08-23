// Disables access to DOM typings like `HTMLElement` which are not available
// inside a service worker and instantiates the correct globals
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

// Ensures that the `$service-worker` import has proper type definitions
/// <reference types="@sveltejs/kit" />

// Only necessary if you have an import from `$env/static/public`
/// <reference types="../.svelte-kit/ambient.d.ts" />

import { immutable, assets, prerendered } from '$app/manifest';
import { version } from '$app/env';

// This gives `self` the correct types
const self = globalThis.self as unknown as ServiceWorkerGlobalScope;

// Create a unique cache name for this deployment
const CACHE = `cache-${version}`;

const ASSETS = [
	...immutable, // the app itself
	...assets, // everything in `static`
	...prerendered
].map((p) => p.path);

self.addEventListener('install', (event) => {
	// Create a new cache and add all files to it
	async function addFilesToCache() {
		const cache = await caches.open(CACHE);
		await cache.addAll(ASSETS);
	}

	event.waitUntil(addFilesToCache());
});

self.addEventListener('activate', (event) => {
	// Remove previous cached data from disk
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (key !== CACHE) await caches.delete(key);
		}
	}

	event.waitUntil(deleteOldCaches());
});

self.addEventListener('fetch', (event) => {
	// ignore POST requests etc
	if (event.request.method !== 'GET') return;

	async function respond() {
		const cache = await caches.open(CACHE);
		const url = new URL(event.request.url);

		// 1. Handle page navigations
		if (event.request.mode === 'navigate') {
			console.log('Navigation:', event.request.url);
			try {
				const response = await fetch(event.request);
				console.log('Caching response for navigation:', event.request.url);

				if (response.ok) {
					cache.put(event.request, response.clone());
				}

				return response;
			} catch {
				console.log('Offline, checking cache');
				const cached = await cache.match(event.request);
				console.log('Found cached?', !!cached);
				if (cached) return cached;
				throw new Error('Network error and no cached page');
			}
		}

		const dataUrl = new URL(event.request.url);

		if (dataUrl.pathname.endsWith('/__data.json')) {
			dataUrl.search = '';

			const cacheRequest = new Request(dataUrl.toString());

			try {
				// Always prefer the network when online
				const response = await fetch(event.request);

				// Keep the offline copy up-to-date
				if (response.ok) {
					await cache.put(cacheRequest, response.clone());
				}

				return response;
			} catch {
				// Only use the cache if the network failed
				const cached = await cache.match(cacheRequest);
				if (cached) {
					console.log('Serving cached __data.json');
					return cached;
				}

				throw new Error('Network error and no cached data');
			}
		}

		// 2. Ignore non-assets (Supabase, APIs, etc.)
		if (!url.pathname.startsWith('/_app/') && !ASSETS.includes(url.pathname)) {
			return fetch(event.request);
		}

		// 3. Immutable assets
		if (ASSETS.includes(url.pathname)) {
			const cached = await cache.match(url.pathname);
			if (cached) return cached;
		}

		// 4. Network-first for other assets
		try {
			const response = await fetch(event.request);

			if (response.ok && !response.headers.get('cache-control')?.includes('no-store')) {
				cache.put(event.request, response.clone());
			}

			return response;
		} catch {
			const cached = await cache.match(event.request);
			if (cached) return cached;
			throw new Error('Network error and no cached asset');
		}
	}

	event.respondWith(respond());
});
