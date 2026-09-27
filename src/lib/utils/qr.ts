/**
 * @fileoverview QR scanner workflow for browser-based code scanning.
 *
 * Opens a modal-backed QR reader and resolves the scanned payload from the scanner component.
 * This is a convenience helper that keeps the browser logic out of the UI component itself.
 *
 * @example
 * import { scanQR } from '$lib/utils/qr';
 * const result = await scanQR().unwrap();
 */
import { attemptAsync } from 'ts-utils';
import { browser } from '$app/env';
import { rawModal } from '$lib/utils/prompts.svelte';
import { mount } from 'svelte';
import QRScanner from '$lib/components/forms/QRScanner.svelte';

/**
 * Starts a QR scan flow in the browser.
 *
 * @returns {ReturnType<typeof attemptAsync<string>>} Result-wrapped scanned string value.
 */
export const scanQR = () => {
	return attemptAsync(async () => {
		if (!browser) throw new Error('Not in browser environment');
		return new Promise<string>((res, rej) => {
			const modal = rawModal(
				'Scan QR Code',
				[
					{
						color: 'secondary',
						text: 'Cancel',
						onClick: () => {
							rej(new Error('User cancelled QR scan'));
							modal.hide();
						}
					}
				],
				(body) =>
					mount(QRScanner, {
						target: body,
						props: {
							onScan: (result: string) => {
								res(result);
								modal.hide();
							}
						}
					})
			);

			modal.show();

			modal.on('hide', () => setTimeout(() => rej(new Error('User cancelled QR scan')), 100));
		});
	});
};
