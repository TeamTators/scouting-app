import { describe, expect, test } from 'vitest';
import { z } from 'zod';
import { parseDexieValue, stringifyDexieValue, transformDexieRow } from '$lib/services/db/table';

describe('Dexie table storage transforms', () => {
	test('stringifies and parses nullable object and array values for IndexedDB', () => {
		const schema = z.object({
			requires: z.array(z.string()).nullable(),
			meta: z.object({ enabled: z.boolean() }).nullable(),
			tags: z.array(z.string()).optional(),
			nested: z.object({ values: z.array(z.string()) }).nullable()
		});

		const serialized = transformDexieRow(
			schema,
			{
				requires: ['a', 'b'],
				meta: { enabled: true },
				tags: ['x'],
				nested: { values: ['y', 'z'] }
			},
			'serialize'
		);

		expect(serialized.requires).toBe(JSON.stringify(['a', 'b']));
		expect(serialized.meta).toBe(JSON.stringify({ enabled: true }));
		expect(serialized.tags).toBe(JSON.stringify(['x']));
		expect(serialized.nested).toBe(JSON.stringify({ values: ['y', 'z'] }));

		const deserialized = transformDexieRow(
			schema,
			{
				requires: JSON.stringify(['a', 'b']),
				meta: JSON.stringify({ enabled: true }),
				tags: JSON.stringify(['x']),
				nested: JSON.stringify({ values: ['y', 'z'] })
			},
			'deserialize'
		);

		expect(deserialized.requires).toEqual(['a', 'b']);
		expect(deserialized.meta).toEqual({ enabled: true });
		expect(deserialized.tags).toEqual(['x']);
		expect(deserialized.nested).toEqual({ values: ['y', 'z'] });
	});

	test('handles wrapped optional and nullable object schemas when stringifying and parsing', () => {
		const arraySchema = z.array(z.string()).nullable();
		const objectSchema = z.object({ enabled: z.boolean() }).nullable();

		expect(stringifyDexieValue(arraySchema, ['one', 'two'])).toBe(JSON.stringify(['one', 'two']));
		expect(parseDexieValue(arraySchema, JSON.stringify(['one', 'two']))).toEqual(['one', 'two']);
		expect(stringifyDexieValue(objectSchema, { enabled: true })).toBe(
			JSON.stringify({ enabled: true })
		);
		expect(parseDexieValue(objectSchema, JSON.stringify({ enabled: true }))).toEqual({
			enabled: true
		});
	});
});
