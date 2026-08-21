import supabase from '$lib/server/services/supabase';
import { SupaStruct } from '$lib/services/supabase/supastruct.svelte';
import { describe, it, expect } from 'vitest';

describe('CRUD Tests', () => {
	const struct = SupaStruct.get({
		client: supabase,
		schema: 'test',
		table: 'test',
		debug: true,
		index_db: false
	});

	const joinStruct = SupaStruct.get({
		client: supabase,
		schema: 'test',
		table: 'join_test',
		debug: true,
		index_db: false
	});

	const unwrapCreated = <T>(value: T | T[]) => (Array.isArray(value) ? value[0] : value);

	const expectSyncSuccess = (value: unknown) => {
		if (
			typeof value === 'object' &&
			value !== null &&
			'isErr' in value &&
			typeof (value as { isErr: () => boolean }).isErr === 'function'
		) {
			expect((value as { isErr: () => boolean }).isErr()).toBe(false);
			return;
		}

		expect(Array.isArray(value)).toBe(true);
	};

	const ensureCleanup = async (testId: string) => {
		const joinRows = await joinStruct.get({ test_id: testId }).unwrapOr([]);
		for (const row of joinRows) {
			await row.delete();
		}

		const testRow = await struct.fromId(testId);
		if (testRow.isOk()) {
			await testRow.value.delete();
		}
	};

	it('runs exhaustive CRUD + join flow', async () => {
		const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		const idPrimary = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
		const idSecondary =
			globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}-secondary`;
		const agePrimary = Math.round(Math.random() * 100);
		const ageSecondary = Math.round(Math.random() * 100);
		const primaryName = `CRUD Test Primary ${uniqueSuffix}`;
		const secondaryName = `CRUD Test Secondary ${uniqueSuffix}`;
		const joinPrimaryId = Math.floor(Date.now() / 1000);
		const joinSecondaryId = joinPrimaryId + 1;
		const createdAt = new Date().toISOString();

		await ensureCleanup(idPrimary);
		await ensureCleanup(idSecondary);

		try {
			const createdPrimaryResult = await struct.new({
				id: idPrimary,
				name: primaryName,
				age: agePrimary,
				archived: false,
				created_at: createdAt
			});
			expect(createdPrimaryResult.isErr()).toBe(false);
			if (createdPrimaryResult.isErr()) {
				throw new Error(`Primary creation failed: ${createdPrimaryResult.error.message}`);
			}
			const createdPrimary = unwrapCreated(createdPrimaryResult.unwrap());
			expect(createdPrimary).toBeTruthy();

			const createdSecondaryResult = await struct.new({
				id: idSecondary,
				name: secondaryName,
				age: ageSecondary,
				archived: false,
				created_at: createdAt
			});
			expect(createdSecondaryResult.isErr()).toBe(false);
			if (createdSecondaryResult.isErr()) {
				throw new Error(`Secondary creation failed: ${createdSecondaryResult.error.message}`);
			}
			const createdSecondary = unwrapCreated(createdSecondaryResult.unwrap());
			expect(createdSecondary).toBeTruthy();

			const joinPrimaryResult = await joinStruct.new({
				id: joinPrimaryId,
				test_id: idPrimary,
				archived: false,
				created_at: createdAt
			});
			if (joinPrimaryResult.isErr()) {
				throw new Error(`join_test creation (primary) failed: ${joinPrimaryResult.error.message}`);
			}
			expect(joinPrimaryResult.isErr()).toBe(false);

			const joinSecondaryResult = await joinStruct.new({
				id: joinSecondaryId,
				test_id: idSecondary,
				archived: false,
				created_at: createdAt
			});
			if (joinSecondaryResult.isErr()) {
				throw new Error(
					`join_test creation (secondary) failed: ${joinSecondaryResult.error.message}`
				);
			}
			expect(joinSecondaryResult.isErr()).toBe(false);

			const readPrimaryResult = await struct.fromId(idPrimary);
			expect(readPrimaryResult.isErr()).toBe(false);
			if (readPrimaryResult.isErr()) {
				throw new Error(`Primary read failed: ${readPrimaryResult.error.message}`);
			}
			const readPrimary = readPrimaryResult.unwrap();
			expect(readPrimary.id).toBe(idPrimary);
			expect(readPrimary.raw.age).toBe(agePrimary);

			const getRows = await struct.get({ id: idPrimary }).unwrap();
			expect(getRows.length).toBe(1);
			expect(getRows[0]?.id).toBe(idPrimary);

			const getOrRows = await struct.getOR({ id: idPrimary, name: primaryName }).unwrap();
			expect(getOrRows.some((row) => row.id === idPrimary)).toBe(true);

			const searchRows = await struct
				.search({
					type: 'and',
					conditions: [
						{ field: 'id', operator: 'eq', value: idPrimary },
						{ field: 'name', operator: 'ilike', value: `%${uniqueSuffix}%` }
					]
				})
				.unwrap();
			expect(searchRows.some((row) => row.id === idPrimary)).toBe(true);

			const allQuery = struct.search({
				field: 'name',
				operator: 'ilike',
				value: `%${uniqueSuffix}%`
			});
			const page1 = await allQuery.paginated.page(1, 1);
			expect(page1.count).toBeGreaterThanOrEqual(1);
			expect(page1.data.length).toBeLessThanOrEqual(1);

			const firstResult = await allQuery.first();
			expect(firstResult.isErr()).toBe(false);
			if (firstResult.isErr()) {
				throw new Error(`first() failed: ${firstResult.error.message}`);
			}
			expect(firstResult.value).toBeTruthy();

			const lastResult = await allQuery.last();
			expect(lastResult.isErr()).toBe(false);
			if (lastResult.isErr()) {
				throw new Error(`last() failed: ${lastResult.error.message}`);
			}
			expect(lastResult.value).toBeTruthy();

			const syncResult = await allQuery.sync(0);
			expectSyncSuccess(syncResult);

			const joinQuery = struct.join(joinStruct, {
				whereB: { test_id: idPrimary },
				requiredA: ['id', 'name', 'age'],
				requiredB: ['id', 'test_id']
			});

			const joinedRows = await joinQuery.unwrap();
			expect(joinedRows.some((row) => row.id === idPrimary)).toBe(true);
			expect(joinedRows.some((row) => row.id === idSecondary)).toBe(false);

			const joinCountResult = await joinQuery.count();
			expect(joinCountResult.isErr()).toBe(false);
			if (joinCountResult.isErr()) {
				throw new Error(`join count() failed: ${joinCountResult.error.message}`);
			}
			expect(joinCountResult.value).toBeGreaterThanOrEqual(1);

			const joinPage = await joinQuery.paginated.page(1, 10);
			expect(joinPage.count).toBeGreaterThanOrEqual(1);
			expect(joinPage.data.some((row) => row.id === idPrimary)).toBe(true);

			const joinFirst = await joinQuery.first();
			expect(joinFirst.isErr()).toBe(false);
			const joinLast = await joinQuery.last();
			expect(joinLast.isErr()).toBe(false);

			const joinSyncResult = await joinQuery.sync(0);
			expectSyncSuccess(joinSyncResult);

			await joinQuery.fetch_all().unwrap();

			const realtimeUpdate = await readPrimary.update({ age: agePrimary + 5 });
			expect(realtimeUpdate.isErr()).toBe(false);
			if (realtimeUpdate.isErr()) {
				throw new Error(`Update failed: ${realtimeUpdate.error.message}`);
			}

			const postRealtimeRead = await struct.fromId(idPrimary);
			expect(postRealtimeRead.isErr()).toBe(false);
			if (postRealtimeRead.isErr()) {
				throw new Error(`Post-realtime read failed: ${postRealtimeRead.error.message}`);
			}
			expect(postRealtimeRead.value.raw.age).toBe(agePrimary + 5);

			const deleteJoinPrimary = await joinStruct.get({ test_id: idPrimary }).unwrapOr([]);
			for (const row of deleteJoinPrimary) {
				const deleteJoinResult = await row.delete();
				expect(deleteJoinResult.isErr()).toBe(false);
			}

			const deleteJoinSecondary = await joinStruct.get({ test_id: idSecondary }).unwrapOr([]);
			for (const row of deleteJoinSecondary) {
				const deleteJoinResult = await row.delete();
				expect(deleteJoinResult.isErr()).toBe(false);
			}

			const deletePrimary = await readPrimary.delete();
			expect(deletePrimary.isErr()).toBe(false);
			if (deletePrimary.isErr()) {
				throw new Error(`Primary delete failed: ${deletePrimary.error.message}`);
			}

			const secondaryRead = await struct.fromId(idSecondary);
			if (secondaryRead.isOk()) {
				const deleteSecondary = await secondaryRead.value.delete();
				expect(deleteSecondary.isErr()).toBe(false);
			}

			const afterDeletePrimary = await struct.fromId(idPrimary);
			expect(afterDeletePrimary.isErr()).toBe(true);

			const afterDeleteSecondary = await struct.fromId(idSecondary);
			expect(afterDeleteSecondary.isErr()).toBe(true);
		} finally {
			await ensureCleanup(idPrimary);
			await ensureCleanup(idSecondary);
		}
	}, 60000);
});
