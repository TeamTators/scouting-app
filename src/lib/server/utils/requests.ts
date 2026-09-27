/**
 * @fileoverview Cached HTTP request helper backed by SupaStruct.
 *
 * This utility stores GET results in the app’s cached request table to avoid re-fetching the
 * same data while respecting TTL and response headers. It is intended for deterministic,
 * low-frequency fetches rather than ad hoc runtime requests.
 *
 * @example
 * import { request } from '$lib/server/utils/requests';
 * const response = await request('https://example.com/data').unwrap();
 */
import { SupaStruct } from '$lib/services/supabase/supastruct.svelte';
import { attemptAsync } from 'ts-utils';
import client from '$lib/server/services/supabase';
import { z } from 'zod';

/**
 * Fetches a URL while using the cached_request table for TTL-based GET caching.
 *
 * @param {string} url - Request URL.
 * @param {RequestInit} [options] - Fetch options.
 * @returns {ReturnType<typeof attemptAsync<Response>>} Result-wrapped Response object.
 */
export const request = (url: string, options?: RequestInit) => {
	return attemptAsync(async () => {
		if (['GET', 'QUERY'].includes(options?.method || 'GET')) {
			const Requests = SupaStruct.get({
				client,
				schema: 'core',
				table: 'cached_request'
			});
			const has = await Requests.get({ url }).first();
			let response: Response | null = null;
			if (has.isErr()) {
				response = await fetch(url, options);
			}
			CACHE: if (has.isOk() && has.value) {
				if (has.value.raw.response === null) break CACHE;
				if (has.value.raw.ttl + new Date(has.value.raw.created_at).getTime() < Date.now())
					break CACHE;
				const headers = new Headers();
				headers.set('Content-Type', 'application/json');
				const cached_headers = z.record(z.string()).safeParse(has.value.raw.headers);
				if (cached_headers.success) {
					for (const [key, value] of Object.entries(cached_headers.data)) {
						headers.set(key, value);
					}
				}
				response = new Response(has.value.raw.response, {
					status: 300,
					headers
				});
			}
			if (!response) {
				response = await fetch(url, options);
				const body = await response
					.clone()
					.json()
					.catch(() => null);
				if (response.ok)
					await Requests.upsert(
						[
							{
								url,
								response: JSON.stringify(body),
								headers: JSON.stringify(response.headers),
								ttl: 1000 * 60 * 60 * 24, // 1 day
								status: response.status
							}
						],
						{ onConflict: 'url' }
					);
			}
			return response;
		} else {
			return fetch(url, options);
		}
	});
};
