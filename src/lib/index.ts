// place files you want to import through the `$lib` alias in this folder.
import '@total-typescript/ts-reset';
import { fingerprint } from './utils/fingerprint';

import { Requests } from './utils/requests';
import { browser } from '$app/environment';

fingerprint();

export const ogFetch = (() => {
	if (!browser) return fetch;
	const og = window.fetch;
	window.fetch = (url: URL | RequestInfo, config?: RequestInit) => {
		const headers = new Headers(config?.headers);

		for (const [k, v] of Object.entries(Requests.metadata)) {
			headers.set(`X-${k}`, v as string);
		}

		return og(url, {
			...config,
			headers
		});
	};
	return og;
})();
