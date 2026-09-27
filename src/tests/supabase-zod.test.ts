import { describe, expect, test } from 'vitest';
import env from '$lib/server/utils/env';
import { generateZodSchemaString } from '../../scripts/supabase/sb-pull-types';

describe('Supabase Zod generation', () => {
	test('handles all primary Supabase field shapes in generated schemas', () => {
		const previousSchemas = env.SB_SCHEMAS;
		env.SB_SCHEMAS = ['potato'];

		try {
			const raw = `
				export type Database = {
					potato: {
						Tables: {
							icon: {
								Row: {
									id: string;
									count: number;
									active: boolean;
									name: string | null;
									requires: string[] | null;
									ratings: number[] | null;
									flags: boolean[] | null;
									metadata: Json | null;
								};
								Insert: {
									id?: string;
									count?: number;
									active?: boolean;
									name?: string | null;
									requires?: string[] | null;
									ratings?: number[] | null;
									flags?: boolean[] | null;
									metadata?: Json | null;
								};
								Update: {
									id?: string;
									count?: number;
									active?: boolean;
									name?: string | null;
									requires?: string[] | null;
									ratings?: number[] | null;
									flags?: boolean[] | null;
									metadata?: Json | null;
								};
							};
						};
					};
				};
			`;

			const schema = generateZodSchemaString(raw);
			expect(schema).toContain('"id": z.string()');
			expect(schema).toContain('"count": z.number()');
			expect(schema).toContain('"active": z.boolean()');
			expect(schema).toContain('"name": z.string().nullable()');
			expect(schema).toContain('"requires": z.array(z.string()).nullable()');
			expect(schema).toContain('"ratings": z.array(z.number()).nullable()');
			expect(schema).toContain('"flags": z.array(z.boolean()).nullable()');
			expect(schema).toContain('"metadata": z.unknown().nullable()');
			expect(schema).toContain('"requires": z.array(z.string()).nullable().optional()');
			expect(schema).toContain('"ratings": z.array(z.number()).nullable().optional()');
			expect(schema).toContain('"flags": z.array(z.boolean()).nullable().optional()');
		} finally {
			env.SB_SCHEMAS = previousSchemas;
		}
	});
});
