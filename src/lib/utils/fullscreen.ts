/* eslint-disable @typescript-eslint/no-explicit-any */
import { browser } from '$app/environment';
<<<<<<< HEAD
import { attempt } from 'ts-utils/check';
=======
import { writable } from 'svelte/store';
>>>>>>> 984257cc6ef87ae0528e26405837ec650c7e5ddc

/**
 * Creates a fullscreen request
 * @param element Fullscreen target
 * @returns A function that exits fullscreen
 */
export const fullscreen = (element: HTMLElement) => {
	if (!browser) return () => {};

	const exit = () => {
		try {
			// Check if the document is actually in fullscreen mode
			const fullscreenElement =
				document.fullscreenElement ||
				(document as any).webkitFullscreenElement ||
				(document as any).mozFullScreenElement ||
				(document as any).msFullscreenElement;

			if (fullscreenElement) {
				if ('exitFullscreen' in document) {
					document.exitFullscreen();
				} else if ('webkitExitFullscreen' in document) {
					(document as any).webkitExitFullscreen();
				} else if ('mozCancelFullScreen' in document) {
					(document as any).mozCancelFullScreen();
				} else if ('msExitFullscreen' in document) {
					(document as any).msExitFullscreen();
				} else {
					console.warn('Fullscreen API is not supported');
				}
				isFullscreen.set(false);
			} else {
				console.warn('Not in fullscreen mode.');
			}
		} catch (error) {
			console.warn('Failed to exit fullscreen:', error);
		}
	};

	try {
		if ('requestFullscreen' in element) {
			element.requestFullscreen();
		} else if ('webkitRequestFullscreen' in element) {
			(element as any).webkitRequestFullscreen();
		} else if ('mozRequestFullScreen' in element) {
			(element as any).mozRequestFullScreen();
		} else if ('msRequestFullscreen' in element) {
			(element as any).msRequestFullscreen();
		} else {
			console.warn('Fullscreen API is not supported');
		}
		isFullscreen.set(true);
	} catch (error) {
		console.warn('Failed to enter fullscreen:', error);
	}

	return exit;
};

export const isFullscreen = writable(false);

if (browser) {
	document.addEventListener('fullscreenchange', () => {
		isFullscreen.set(document.fullscreenElement !== null);
	});
	document.addEventListener('mozfullscreenchange', () => {
		isFullscreen.set((document as any).mozFullScreen !== null);
	});
	document.addEventListener('webkitfullscreenchange', () => {
		isFullscreen.set((document as any).webkitIsFullScreen !== null);
	});
	document.addEventListener('msfullscreenchange', () => {
		isFullscreen.set((document as any).msFullscreenElement !== null);
	});
}
