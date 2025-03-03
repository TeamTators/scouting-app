import { browser } from '$app/environment';

export const globalData = $state(
	browser
		? {
				scout: localStorage.getItem('scout') ?? '',
				prescouting: localStorage.getItem('prescouting') === 'true',
				practice: localStorage.getItem('practice') === 'true'
			}
		: {
				scout: '',
				prescouting: false,
				practice: false
			}
);
