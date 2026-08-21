import { SupaStruct } from '$lib/services/supabase/supastruct.svelte.js';

export const load = async (event) => {
	const parent = await event.parent();

	const Test = SupaStruct.get({
		client: parent.supabase,
		schema: 'test',
		table: 'test',
		debug: true
	});

	const query = Test.search({
		field: 'age',
		operator: 'gt',
		value: 10
	})
		.sort((a, b) => a.raw.age - b.raw.age)
		.reverse();
	query.sync(1000 * 60 * 5); // Sync every 5 minutes

	return {
		query,
		Test
	};
};
