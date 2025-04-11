import { browser } from '$app/environment';

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
