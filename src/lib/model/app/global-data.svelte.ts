/**
 * @fileoverview Shared global scouting UI state persisted in browser storage.
 */

import { browser } from '$app/environment';

/**
 * Global, reactive scout preferences and session metadata.
 *
 * Values are loaded from `localStorage` in browser environments and defaulted
 * server-side.
 *
 * @type {{
 * 	scout: string;
 * 	prescouting: boolean;
 * 	practice: boolean;
 * 	flipX: boolean;
 * 	flipY: boolean;
 * }}
 * @example
 * globalData.scout = 'alice';
 * globalData.flipX = true;
 */
export const globalData = $state(
	browser
		? {
				scout: localStorage.getItem('scout') ?? '',
				prescouting: false, // this should always be false now, but I will leave it here to prevent type errors,
				practice: localStorage.getItem('practice') === 'true',
				flipX: localStorage.getItem('flipX') === 'true',
				flipY: localStorage.getItem('flipY') === 'true'
			}
		: {
				scout: '',
				prescouting: false,
				practice: false,
				flipX: false,
				flipY: false
			}
);
