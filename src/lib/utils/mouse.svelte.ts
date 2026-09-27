/**
 * @fileoverview Browser mouse and touch tracking helper using Svelte reactivity.
 *
 * Tracks the latest pointer coordinates and exposes them to UI code without needing a long-lived
 * service or component-scoped state management.
 *
 * @example
 * import { getMousePosition, track_mouse } from '$lib/utils/mouse.svelte';
 * track_mouse(new MouseEvent('mousemove', { clientX: 100, clientY: 200 }));
 * console.log(getMousePosition());
 */
import { browser } from '$app/env';

/** Current horizontal pointer coordinate. */
let x = $state(0);
/** Current vertical pointer coordinate. */
let y = $state(0);

/**
 * Reads the most recent pointer coordinates.
 *
 * @returns {[number, number]} Current `[x, y]` position.
 */
export const getMousePosition = () => {
	return [x, y];
};

export const track_mouse = (event: MouseEvent) => {
	x = event.clientX;
	y = event.clientY;
};

export const track_touch = (event: TouchEvent) => {
	if (event.touches.length > 0) {
		x = event.touches[0].clientX;
		y = event.touches[0].clientY;
	}
};

if (browser) {
	window.addEventListener('mousemove', track_mouse);
	window.addEventListener('touchstart', track_touch, { passive: true });
	window.addEventListener('touchmove', track_touch, { passive: true });
	window.addEventListener('touchend', track_touch, { passive: true });
}
