/**
 * @fileoverview Browser fingerprint collection and reporting.
 *
 * @example
 * import { fingerprint } from '$lib/utils/fingerprint';
 * await fingerprint();
 */
import { getCurrentBrowserFingerPrint } from '@rajesh896/broprint.js';
import { attemptAsync } from 'ts-utils';
import { browser } from '$app/env';
import { metadata } from '$lib/utils/meta';

/**
 * Computes a browser fingerprint and reports it to the server.
 */
export const fingerprint = () => {
	return attemptAsync(async () => {
		if (!browser) {
			throw new Error('Fingerprinting is only available in the browser environment.');
		}
		const fingerprint = await getCurrentBrowserFingerPrint();
		if (!fingerprint) {
			throw new Error('Failed to retrieve fingerprint');
		}

		metadata.set('fingerprint', fingerprint);
		return fingerprint;
	});
};
