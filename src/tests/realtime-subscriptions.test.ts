/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { z } from 'zod';
import { add_subscription } from '$lib/services/supabase/supastruct.svelte';

describe('realtime subscription grouping', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.runOnlyPendingTimers();
		vi.useRealTimers();
		vi.clearAllMocks();
	});

	test('deduplicates identical filters while invoking every callback for the same payload', async () => {
		const onCalls: Array<{
			filter: string | undefined;
			callback: (payload: any) => Promise<void>;
		}> = [];
		const channel = {
			topic: 'table-db-changes',
			on: vi.fn((event, options, callback) => {
				onCalls.push({ filter: options.filter, callback });
				return channel;
			}),
			subscribe: vi.fn()
		};
		const client = {
			serviceRole: true,
			getChannels: vi.fn(() => []),
			removeChannel: vi.fn(),
			channel: vi.fn(() => channel)
		} as any;

		const struct = {
			schema: 'core',
			table: 'profile',
			log: vi.fn(),
			Generator: vi.fn((data) => ({ raw: data })),
			Hydrate: vi.fn(),
			purge_cache: vi.fn(),
			getDexie: vi.fn(() => null),
			getSchemaDefinition: vi.fn(() => ({ Row: z.object({ id: z.string(), name: z.string() }) }))
		} as any;

		const first = vi.fn();
		const second = vi.fn();

		await add_subscription(client, { struct, filter: 'id=eq.123', callback: first });
		await add_subscription(client, { struct, filter: 'id=eq.123', callback: second });

		vi.advanceTimersByTime(1000);

		expect(client.channel).toHaveBeenCalledTimes(1);
		expect(channel.on).toHaveBeenCalledTimes(1);
		expect(onCalls).toHaveLength(1);
		expect(onCalls[0].filter).toBe('id=eq.123');

		const payload = {
			eventType: 'UPDATE',
			new: { id: '123', name: 'alice' },
			old: { id: '123', name: 'bob' }
		};

		await onCalls[0].callback(payload as any);
		expect(first).toHaveBeenCalledTimes(1);
		expect(second).toHaveBeenCalledTimes(1);
		expect(first).toHaveBeenCalledWith({ raw: payload.new }, 'UPDATE', payload.old);
		expect(second).toHaveBeenCalledWith({ raw: payload.new }, 'UPDATE', payload.old);
	});
});
