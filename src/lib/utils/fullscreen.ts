/**
 * @fileoverview Fullscreen helper utilities.
 *
 * @example
 * import { fullscreen } from '$lib/utils/fullscreen';
 * const exit = fullscreen();
 */
import { browser } from '$app/env';
import { attempt } from 'ts-utils';

/**
 * Creates a fullscreen request
 * @param _target Fullscreen target
 * @returns A function that exits fullscreen
 */
export const fullscreen = (element?: Node) => {
	if (!browser) return () => {};
	if (!element) element = document.documentElement;
	const end = () =>
		attempt(() => {
			// exit fullscreen
			if (document.fullscreenElement) {
				document.exitFullscreen(); //.then(() => console.log);
			}
		});

	end(); // exit current fullscreen

	try {
		if (document['exitFullscreen']) {
			document['exitFullscreen']();
		} else if (Object.prototype.hasOwnProperty.call(document, 'webkitExitFullscreen')) {
			Object.getOwnPropertyDescriptor(document, 'webkitExitFullscreen')?.value?.call(document);
		} else if (Object.prototype.hasOwnProperty.call(document, 'mozCancelFullScreen')) {
			Object.getOwnPropertyDescriptor(document, 'mozCancelFullScreen')?.value?.call(document);
		} else if (Object.prototype.hasOwnProperty.call(document, 'msExitFullscreen')) {
			Object.getOwnPropertyDescriptor(document, 'msExitFullscreen')?.value?.call(document);
		}
	} catch (error) {
		console.error('Error exiting fullscreen:', error);
	}

	if (Object.prototype.hasOwnProperty.call(element, 'requestFullscreen')) {
		console.log('Requesting fullscreen for element:', element);
		(
			element as Node & {
				requestFullscreen: () => Promise<void>;
			}
		).requestFullscreen();
	} else {
		console.warn('Fullscreen API is not supported for this element:', element);
	}

	return end;
};
