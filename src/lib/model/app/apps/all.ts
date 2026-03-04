/**
 * @fileoverview Entry-point selector for year-specific app builders.
 */

import build2025 from './2025';
import build2026 from './2026';

/**
 * Returns the app builder function for a supported season.
 *
 * @param {2024 | 2025} year - Season year selector.
 * @returns {typeof build2025} Builder function for the selected year.
 * @example
 * const build = buildForYear(2025);
 */
export const build = (year: 2024 | 2025) => {
	switch (year) {
		case 2025:
			return build2025;
		case 2026:
			return build2026;

		default:
			throw new Error('Not found');
	}
};
