import { Table } from '../db/table';

export const SupaCache = new Table(
	'supa_cache',
	{
		table: 'string',
		key: 'string',
		value: 'array',
		expires: 'date'
	},
	{
		debug: true
	}
);

setInterval(async () => {
	const now = new Date();
	const res = await SupaCache.where('expires', 'lte', now, {
		pagination: false
	});
	if (res.isOk()) {
		for (const row of res.value.data) {
			row.delete();
		}
	}
}, 60 * 1000);
