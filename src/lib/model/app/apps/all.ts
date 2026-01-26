import build2025 from './2025';
import build2026 from './2026';

export const build = (year: 2025 | 2026) => {
	switch (year) {
		case 2025:
			return build2025;
		case 2026:
			return build2026;

		default:
			throw new Error('Not found');
	}
};
