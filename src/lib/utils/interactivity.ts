/**
 * @fileoverview Lightweight interaction timing helper for browser sessions.
 *
 * Tracks the most recent user activity so other helpers can pause network pings or idle-aware
 * actions when the user is inactive.
 *
 * @example
 * import { get_last_interaction } from '$lib/utils/interactivity';
 * console.log(get_last_interaction());
 */
import { browser } from '$app/env';

/**
 * Unix timestamp for the last observed user interaction.
 */
let last_interaction: number | null = null;

/**
 * Records the current time whenever the user interacts with the page.
 */
const set_last_interaction = () => {
	last_interaction = Date.now();
};

export const get_last_interaction = () => {
	return last_interaction;
};

if (browser) {
	window.addEventListener('mousemove', set_last_interaction);
	window.addEventListener('keydown', set_last_interaction);
	window.addEventListener('mousedown', set_last_interaction);
	window.addEventListener('touchstart', set_last_interaction);
	window.addEventListener('scroll', set_last_interaction);
}
