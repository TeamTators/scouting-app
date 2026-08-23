import { browser } from '$app/env';

let x = $state(0);
let y = $state(0);

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
