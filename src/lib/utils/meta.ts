/**
 * @fileoverview Small in-memory metadata map for short-lived page metadata state.
 *
 * Use this for browser-side metadata values that need to be shared across a route or component
 * without creating a full service layer. It is intentionally not persistent.
 *
 * @example
 * import { metadata } from '$lib/utils/meta';
 * metadata.set('title', 'Dashboard');
 */
export const metadata = new Map<string, string>();
