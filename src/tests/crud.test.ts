/**
 * @vitest-environment node
 */

import supabase from '$lib/server/services/supabase';
import { SupaStruct } from '$lib/services/supabase/supastruct.svelte';
import { describe, it, expect } from 'vitest';

describe('CRUD Tests', () => {
	const struct = SupaStruct.get({
		client: supabase,
		schema: 'test',
		table: 'test',
		debug: true
	});

	it('runs create, read, update, and delete flow', async () => {
		const age = Math.round(Math.random() * 100);
		const uniqueName = `CRUD Test ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
		const createdAt = new Date().toISOString();

		const createdResult = await struct.new({
			id,
			name: uniqueName,
			age,
			archived: false,
			created_at: createdAt
		});
		if (createdResult.isErr()) {
			throw new Error(`Creation failed: ${createdResult.error.message}`);
		}
		expect(createdResult.isErr()).toBe(false);

		const createdRows = createdResult.unwrap();
		const created = Array.isArray(createdRows) ? createdRows[0] : createdRows;
		if (!created) {
			throw new Error('Creation returned no rows');
		}
		expect(created.raw.name).toBe(uniqueName);
		expect(created.raw.age).toBe(age);
		expect(created.raw.archived).toBe(false);

		const readResult = await struct.fromId(created.id);
		expect(readResult.isErr()).toBe(false);
		if (readResult.isErr()) {
			throw new Error(`Read failed: ${readResult.error.message}`);
		}

		const read = readResult.unwrap();
		expect(read.id).toBe(created.id);
		expect(read.raw.name).toBe(uniqueName);

		const updateResult = await created.update({
			name: `${uniqueName} Updated`,
			age: age + 1
		});
		expect(updateResult.isErr()).toBe(false);
		if (updateResult.isErr()) {
			throw new Error(`Update failed: ${updateResult.error.message}`);
		}

		expect(created.raw.name).toBe(`${uniqueName} Updated`);
		expect(created.raw.age).toBe(age + 1);

		const deleteResult = await created.delete();
		expect(deleteResult.isErr()).toBe(false);
		if (deleteResult.isErr()) {
			throw new Error(`Delete failed: ${deleteResult.error.message}`);
		}

		const afterDeleteResult = await struct.fromId(created.id);
		expect(afterDeleteResult.isErr()).toBe(true);
	}, 30000);
});
