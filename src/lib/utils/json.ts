/**
 * @fileoverview Deterministic JSON serializer for stable object comparison.
 *
 * This helper sorts object keys before serialization so equivalent objects with a different key
 * order produce the same string. Useful for cache keys, deduping, and deterministic snapshots.
 *
 * @example
 * import { stable_stringify } from '$lib/utils/json';
 * stable_stringify({ b: 2, a: 1 });
 */
export const stable_stringify = (value: unknown): string => {
	if (value === null || typeof value !== 'object') {
		return JSON.stringify(value);
	}

	if (Array.isArray(value)) {
		return `[${value.map(stable_stringify).join(',')}]`;
	}

	const obj = value as Record<string, unknown>;

	const keys = Object.keys(obj).sort();

	return `{${keys.map((key) => `${JSON.stringify(key)}:${stable_stringify(obj[key])}`).join(',')}}`;
};
