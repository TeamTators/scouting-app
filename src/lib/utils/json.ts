export const stable_stringify = (value: unknown): string => {
	if (value === null || typeof value !== 'object') {
		return JSON.stringify(value);
	}

	if (Array.isArray(value)) {
		return `[${value.map(stable_stringify).join(',')}]`;
	}

	const obj = value as Record<string, unknown>;

	const keys = Object.keys(obj).sort();

	return `{${keys.map((key) => `${JSON.stringify(key)}:${stable_stringify(obj[key])}`).join(',')}}`;
};
