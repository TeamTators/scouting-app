/**
 * @fileoverview Theme store helpers for light/dark mode.
 *
 * @example
 * import { setTheme, theme } from '$lib/utils/theme';
 * setTheme('dark');
 */
import { browser } from '$app/env';
import { writable } from 'svelte/store';
import { Color } from 'colors/color';

/**
 * Writable theme store.
 */
export const theme = writable<'light' | 'dark'>('light');

/**
 * Updates the theme and persists it to localStorage.
 *
 * @param {'light'|'dark'} documentTheme - Theme name.
 */
export const setTheme = (documentTheme: 'light' | 'dark') => {
	theme.set(documentTheme);
	if (browser) {
		document.body.setAttribute('data-bs-theme', documentTheme);
		localStorage.setItem('theme', documentTheme);
	}
};

if (browser) {
	const savedTheme = localStorage.getItem('theme');
	if (savedTheme === 'light' || savedTheme === 'dark') {
		setTheme(savedTheme);
	} else {
		const prefersDark =
			window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
		setTheme(prefersDark ? 'dark' : 'light');
	}
}

export const getPallette = () => {
	if (!browser)
		return {
			primary: Color.fromHex('#0d6efd'),
			secondary: Color.fromHex('#6c757d'),
			success: Color.fromHex('#198754'),
			danger: Color.fromHex('#dc3545'),
			warning: Color.fromHex('#ffc107'),
			info: Color.fromHex('#0dcaf0'),
			light: Color.fromHex('#f8f9fa'),
			dark: Color.fromHex('#212529'),
			gray: Color.fromHex('#6c757d'),

			layer_1: Color.fromHex('#ffffff'),
			layer_2: Color.fromHex('#f8f9fa'),
			layer_3: Color.fromHex('#e9ecef'),
			layer_4: Color.fromHex('#dee2e6'),
			layer_5: Color.fromHex('#ced4da')
		};
	const styles = getComputedStyle(document.documentElement);
	return {
		primary: Color.fromHex(styles.getPropertyValue('--bs-primary').trim()),
		secondary: Color.fromHex(styles.getPropertyValue('--bs-secondary').trim()),
		success: Color.fromHex(styles.getPropertyValue('--bs-success').trim()),
		danger: Color.fromHex(styles.getPropertyValue('--bs-danger').trim()),
		warning: Color.fromHex(styles.getPropertyValue('--bs-warning').trim()),
		info: Color.fromHex(styles.getPropertyValue('--bs-info').trim()),
		light: Color.fromHex(styles.getPropertyValue('--bs-light').trim()),
		dark: Color.fromHex(styles.getPropertyValue('--bs-dark').trim()),
		gray: Color.fromHex(styles.getPropertyValue('--bs-gray').trim()),

		layer_1: Color.parse(styles.getPropertyValue('--bs-layer-1').trim()),
		layer_2: Color.parse(styles.getPropertyValue('--bs-layer-2').trim()),
		layer_3: Color.parse(styles.getPropertyValue('--bs-layer-3').trim()),
		layer_4: Color.parse(styles.getPropertyValue('--bs-layer-4').trim()),
		layer_5: Color.parse(styles.getPropertyValue('--bs-layer-5').trim())
	};
};
