/**
 * @vitest-environment node
 */

import supabase from '$lib/server/services/supabase';
import { SupaStruct } from '$lib/services/supabase/supastruct';
import { describe, it, expect } from 'vitest';

describe('Realtime Tests', () => {
	const struct = SupaStruct.get({
		client: supabase,
		name: 'test',
		debug: true
	});

	struct.setupListeners();

	it('Should run the create-update-delete flow', async () => {
		const age = Math.round(Math.random() * 100);
		const created = await struct
			.new({
				name: 'Realtime Test',
				age
			})
			.await()
			.unwrap();
		if (created.pending) throw new Error('Creation is pending');
		if ('error' in created) throw new Error('Creation failed: ' + created.error.message);

		const [data] = created.result;
		expect(data).toBeDefined();
		if (!data) throw new Error('Data is not defined'); // should never happen but for type safety
		expect(data.data.name).toBe('Realtime Test');
		expect(data.data.age).toBe(age);
		const id = data.id || '';


		const updated = await data
			.update((data) => ({
				...data,
				age: age + 1
			}))
			.await()
			.unwrap();
		if (updated.pending) throw new Error('Update is pending');
		if ('error' in updated) throw new Error('Update failed: ' + updated.error.message);


		const deleted = await data.delete().await().unwrap();
		if (deleted.pending) throw new Error('Delete is pending');
		if ('error' in deleted) throw new Error('Delete failed: ' + deleted.error.message);
	}, 30000);
});
