// place files you want to import through the `$lib` alias in this folder.
import '@total-typescript/ts-reset';
import { fingerprint } from '$lib/utils/fingerprint';

import { browser } from '$app/env';
import { metadata } from '$lib/utils/meta';
import '$lib/imports';

fingerprint();

export const ogFetch = (() => {
	if (!browser) return fetch;
	const og = window.fetch;
	window.fetch = (url: URL | RequestInfo, config?: RequestInit) => {
		const headers = new Headers(config?.headers);

		for (const [key, value] of metadata.entries()) {
			headers.set(key, value);
		}

		return og(url, {
			...config,
			headers
		});
	};
	return og;
})();
