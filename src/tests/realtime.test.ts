/**
 * @vitest-environment node
 */

import supabase from '$lib/server/services/supabase';
import { SupaStruct } from '$lib/services/supabase/supastruct';
import { describe, it, expect } from 'vitest';
import { SupaStructData } from '$lib/services/supabase/supastruct-data';

describe('Realtime Tests', () => {
	const struct = SupaStruct.get({
		client: supabase,
		name: 'test',
		debug: true
	});

	struct.setupListeners();

	it('Should run the create-update-delete flow', async () => {
		await new Promise<void>((res) =>
			struct.on('realtime', (status) => {
				if (status === 'SUBSCRIBED') setTimeout(res, 200);
			})
		);
		const createPromise = new Promise<SupaStructData<'test'>>((res, rej) => {
			struct.on('new', (data) => {
				res(data);
			});
			setTimeout(() => {
				rej(new Error('Did not receive create event within 10 seconds'));
			}, 10000);
		});
		const updatePromise = new Promise<SupaStructData<'test'>>((res, rej) => {
			struct.on('update', (data) => {
				res(data);
			});
			setTimeout(() => {
				rej(new Error('Did not receive update event within 10 seconds'));
			}, 20000);
		});
		const deletePromise = new Promise<SupaStructData<'test'>>((res, rej) => {
			struct.on('delete', (data) => {
				res(data);
			});
			setTimeout(() => {
				rej(new Error('Did not receive delete event within 10 seconds'));
			}, 30000);
		});

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

		const createdData = await createPromise;
		expect(createdData).toBeDefined();
		expect(createdData.data.name).toBe('Realtime Test');
		expect(createdData.data.age).toBe(age);
		expect(createdData.id).toBe(id);

		const updated = await data
			.update((data) => ({
				...data,
				age: age + 1
			}))
			.await()
			.unwrap();
		if (updated.pending) throw new Error('Update is pending');
		if ('error' in updated) throw new Error('Update failed: ' + updated.error.message);

		const updatedData = await updatePromise;
		expect(updatedData).toBeDefined();
		expect(updatedData.data.name).toBe('Realtime Test');
		expect(updatedData.data.age).toBe(age + 1);
		expect(updatedData.id).toBe(id);

		const deleted = await data.delete().await().unwrap();
		if (deleted.pending) throw new Error('Delete is pending');
		if ('error' in deleted) throw new Error('Delete failed: ' + deleted.error.message);

		const deletedData = await deletePromise;
		expect(deletedData).toBeDefined();
	}, 30000);
});
