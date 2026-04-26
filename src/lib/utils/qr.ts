import { attemptAsync } from 'ts-utils';
import { browser } from '$app/environment';
import { rawModal } from './prompts';
import { mount } from 'svelte';
import QRScanner from '$lib/components/forms/QRScanner.svelte';

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
