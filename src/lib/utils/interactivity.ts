import { browser } from '$app/environment';

let last_interaction: number | null = null;

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
