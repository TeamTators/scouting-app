/**
 * @fileoverview
 * Typed Supabase data access helpers with reactive caching, realtime synchronization,
 * query composition, and pagination utilities for Svelte 5 runes-based state.
 *
 * This module exposes:
 * - `SupaStruct`: table-scoped data gateway.
 * - `SupaQuery`: lazy/eager query wrapper with reactive cache views.
 * - `SupaPagination`: page state and paginated fetch orchestration.
 * - `SupaStructData`: row wrapper with update/delete helpers.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
// import supabase from "$lib/services/supabase";
import { attempt, attemptAsync, ComplexEventEmitter, type Result, Ok, Err } from 'ts-utils';
import { REALTIME_SUBSCRIBE_STATES, type SupabaseClient } from '@supabase/supabase-js';
import { schemas } from '$lib/types/supabase-zod';
import { z } from 'zod';
import { type Database, type DatabasePivoted, type SchemaName } from '$lib/types/supabase';
import { SvelteMap, SvelteDate } from 'svelte/reactivity';
import { browser } from '$app/environment';

export type Client = SupabaseClient<Database>;

/** Schema names that have generated row metadata. */
export type RowSchemaName = keyof DatabasePivoted['Row'];
/** Schema names that have generated insert metadata. */
export type InsertSchemaName = keyof DatabasePivoted['Insert'];
/** Schema names that have generated update metadata. */
export type UpdateSchemaName = keyof DatabasePivoted['Update'];

export type RowTableName<S extends RowSchemaName> = keyof DatabasePivoted['Row'][S];
export type InsertTableName<S extends InsertSchemaName> = keyof DatabasePivoted['Insert'][S];
export type UpdateTableName<S extends UpdateSchemaName> = keyof DatabasePivoted['Update'][S];

export type RowTableNames<Schema extends SchemaName = SchemaName> = RowTableName<Schema>;
export type InsertTableNames<Schema extends SchemaName = SchemaName> = InsertTableName<Schema>;
export type UpdateTableNames<Schema extends SchemaName = SchemaName> = UpdateTableName<Schema>;

export type Row<
	Schema extends SchemaName,
	Name extends RowTableNames<Schema>
> = DatabasePivoted['Row'][Schema][Name] & {
	id: string;
	created_at: string;
	archived: boolean;
};
export type Insert<
	Schema extends SchemaName,
	Name extends InsertTableNames<Schema>
> = DatabasePivoted['Insert'][Schema][Name];
export type Update<
	Schema extends SchemaName,
	Name extends UpdateTableNames<Schema>
> = DatabasePivoted['Update'][Schema][Name] & {
	archived?: boolean;
};

/**
 * Table metadata and row contract for a table in the active Supabase schema.
 *
 * @template Name - Table name from the generated database type.
 */
export type Table<
	Schema extends SchemaName,
	Name extends keyof Database[Schema]['Tables']
> = Database[Schema]['Tables'][Name];

/**
 * Runtime configuration for a {@link SupaStruct} instance.
 *
 * @template Name - Table name handled by the struct.
 * @property name - Table name in the active schema.
 * @property client - Typed Supabase client.
 * @property versionHistory - Reserved flag for historical row tracking.
 * @property debug - Enables scoped console logging for this struct.
 */
export type SupaConfig<Schema extends RowSchemaName, Name extends RowTableNames<Schema>> = {
	table: Name;
	client: Client;
	schema: Schema;
	versionHistory?: boolean;
	debug?: boolean;
};

export class SupaStruct<Schema extends RowSchemaName, RowName extends RowTableNames<Schema>> {
	public static readonly structs = new SvelteMap<
		string,
		SupaStruct<RowSchemaName, RowTableNames<RowSchemaName>>
	>();

	/**
	 * Creates a struct instance for a table.
	 *
	 * @template Name - Target table name.
	 * @param config - Struct runtime configuration.
	 * @returns A new typed `SupaStruct` instance.
	 *
	 * @example
	 * const users = SupaStruct.get({
	 *   name: 'users',
	 *   client: supabaseClient,
	 *   debug: true
	 * });
	 */
	public static get<Schema extends RowSchemaName, Name extends RowTableNames<Schema>>(
		config: SupaConfig<Schema, Name>
	): SupaStruct<Schema, Name> {
		// const existing = SupaStruct.structs.get(config.name);
		// if (existing) return existing as unknown as SupaStruct<Name>;
		return new SupaStruct(config);
	}

	public readonly cache = $state(new SvelteMap<string, SupaStructData<Schema, RowName>>());
	private readonly em = new ComplexEventEmitter<{
		new: [SupaStructData<Schema, RowName>];
		update: [SupaStructData<Schema, RowName>, Row<Schema, RowName>];
		delete: [SupaStructData<Schema, RowName>];
		archive: [SupaStructData<Schema, RowName>];
		restore: [SupaStructData<Schema, RowName>];
		realtime: [REALTIME_SUBSCRIBE_STATES];
	}>();
	public readonly on = this.em.on.bind(this.em);
	public readonly off = this.em.off.bind(this.em);
	public readonly once = this.em.once.bind(this.em);

	private readonly queryCache = $state(new SvelteMap<string, SupaQuery<Schema, RowName>>());

	/**
	 * Creates a typed table struct.
	 *
	 * @param {SupaConfig<Schema, RowName>} config - Runtime table, schema, and client configuration.
	 * @example
	 * const profiles = new SupaStruct({ schema: 'core', table: 'profile', client: supabase });
	 */
	constructor(private readonly config: SupaConfig<Schema, RowName>) {}

	/**
	 * Validates a raw Supabase transaction payload against an expected cardinality.
	 *
	 * @param transaction - Response payload containing `data` and `error`.
	 * @param expect - Expected result shape (`array`, `single`, or `null`).
	 * @returns A `Result` wrapping typed data or an error.
	 */
	runTransaction(
		transaction: {
			data: Row<Schema, RowName>[] | Row<Schema, RowName> | null;
			error: Error | null;
		},
		expect: 'array'
	): Result<Row<Schema, RowName>[]>;
	runTransaction(
		transaction: {
			data: Row<Schema, RowName>[] | Row<Schema, RowName> | null;
			error: Error | null;
		},
		expect: 'single'
	): Result<Row<Schema, RowName>>;
	runTransaction(
		transaction: {
			data: Row<Schema, RowName>[] | Row<Schema, RowName> | null;
			error: Error | null;
		},
		expect: 'null'
	): Result<null>;
	runTransaction(
		transaction: {
			data: Row<Schema, RowName>[] | Row<Schema, RowName> | null;
			error: Error | null;
		},
		expect: 'array' | 'single' | 'null'
	): Result<Row<Schema, RowName>[] | Row<Schema, RowName> | null> {
		return attempt(() => {
			if (transaction.error) {
				throw transaction.error;
			}
			if (expect === 'array') {
				if (!Array.isArray(transaction.data)) {
					throw new Error(`Expected an array but got ${typeof transaction.data}`);
				}
				return transaction.data;
			} else if (expect === 'single') {
				if (Array.isArray(transaction.data)) {
					throw new Error(`Expected a single object but got an array`);
				}
				if (transaction.data === null) {
					throw new Error(`Expected a single object but got null`);
				}
				return transaction.data;
			} else {
				// expect === 'null'
				if (transaction.data !== null) {
					throw new Error(`Expected null but got ${typeof transaction.data}`);
				}
				return null;
			}
		});
	}

	/**
	 * Returns the typed table name used by this struct.
	 *
	 * @returns {Extract<RowName, string>} Table name.
	 * @example
	 * console.log(struct.table);
	 */
	get table() {
		return String(this.config.table) as Extract<RowName, string>;
	}

	/**
	 * Returns the configured Supabase client.
	 *
	 * @returns {Client} Supabase client bound to the app database type.
	 * @example
	 * await struct.supabase.schema('core').from(struct.table).select('*');
	 */
	get supabase() {
		return this.config.client;
	}

	/**
	 * Returns the configured schema name.
	 *
	 * @returns {Schema} Active schema name.
	 * @example
	 * console.log(struct.schema);
	 */
	get schema() {
		return this.config.schema;
	}

	/**
	 * Logs scoped debug output when debug mode is enabled.
	 *
	 * @param {...unknown[]} args - Values to log.
	 * @returns {void}
	 * @example
	 * struct.log('Loaded rows', rows.length);
	 */
	log(...args: unknown[]) {
		if (this.config.debug) {
			console.log(`[SupaStruct:${this.table}]`, ...args);
		}
	}

	/**
	 * Subscribes to realtime row change events for this table and syncs cache/event streams.
	 *
	 * @returns {void}
	 * @example
	 * struct.initRealtime();
	 */
	initRealtime(config?: { filter?: string }) {
		const channel = this.supabase.channel(`realtime:${this.config.schema}:${this.table}`);
		channel
			.on(
				'postgres_changes',
				{ event: '*', schema: this.config.schema, table: this.table, filter: config?.filter },
				(payload) => {
					this.log('Received realtime payload:', payload);
					switch (payload.eventType) {
						case 'INSERT': {
							const data = this.Generator(payload.new as Row<Schema, RowName>);
							this.em.emit('new', data);
							break;
						}
						case 'UPDATE': {
							const existing = this.cache.get(String(payload.old.id));
							if (existing) {
								const validated = this.validate(payload.new);
								Object.assign(existing.raw as any, validated);
								this.em.emit('update', existing, validated);
							} else {
								const data = this.Generator(payload.new as Row<Schema, RowName>);
								this.em.emit('update', data, payload.new as Row<Schema, RowName>);
							}
							break;
						}
						case 'DELETE': {
							const existing = this.cache.get(String(payload.old.id));
							if (existing) {
								this.cache.delete(String(payload.old.id));
								this.em.emit('delete', existing);
							}
							break;
						}
					}
				}
			)
			.subscribe((status) => {
				this.log('Realtime subscription status:', status);
				this.em.emit('realtime', status);
			});

		return () => {
			this.supabase.removeChannel(channel);
		};
	}

	/**
	 * Validates input against the generated zod row schema for this table.
	 *
	 * @param {unknown} data - Unknown payload to validate.
	 * @returns {Row<Schema, RowName>} Parsed row-like object
	 * @throws If the table schema is missing or parsing fails.
	 * @example
	 * const row = struct['validate'](payload);
	 */
	private validate(data: unknown): Row<Schema, RowName> {
		const schema =
			((schemas as any)[this.schema]?.[this.table] as
				| {
						Row: typeof z.any;
						Insert: typeof z.any;
						Update: typeof z.any;
				  }
				| undefined) ?? ((schemas as any)[this.table] as any);
		if (!schema) {
			throw new Error(`No schema found for table ${this.table}`);
		}
		const parseResult = schema.Row.safeParse(data);
		if (!parseResult.success) {
			throw new Error(
				`Failed to validate data for table ${this.table}: ` + parseResult.error.message
			);
		}
		return parseResult.data;
	}

	/**
	 * Normalizes a row payload into a cached `SupaStructData` instance.
	 *
	 * @param {Row<Schema, RowName>} row - Raw or typed row payload.
	 * @returns {SupaStructData<Schema, RowName>} Stable row wrapper.
	 * @example
	 * const wrapped = struct.Generator(rawRow);
	 */
	Generator(row: Row<Schema, RowName>): SupaStructData<Schema, RowName> {
		const validated = this.validate(row);
		const exists = this.cache.get(String(validated.id));
		if (exists) {
			this.log(`Cache hit for row with id ${validated.id}`);
			return exists;
		}

		const rowData = new SupaStructData<Schema, RowName>(this, validated);
		if (browser) {
			try {
				this.cache.set(String(validated.id), rowData);
			} catch {
				//
			}
		}
		return rowData;
	}

	/**
	 * Fetches rows that satisfy all provided field/value pairs.
	 *
	 * @param {Partial<Row<Schema, RowName>>} queryData - AND-style match criteria.
	 * @returns {SupaQuery<Schema, RowName>} Query wrapper with reactive and paginated access.
	 * @example
	 * const q = struct.get({ archived: false });
	 * const rows = await q;
	 */
	get(queryData: Partial<Row<Schema, RowName>>) {
		const cacheKey = `get:${JSON.stringify(queryData)}`;
		const cached = this.queryCache.get(cacheKey);
		if (cached) return cached;

		const satisfies = (data: SupaStructData<Schema, RowName>) =>
			Object.entries(queryData).every(
				([key, value]) => data.raw[key as keyof Row<Schema, RowName>] === value
			);

		const allQuery = async () => {
			let query = this.supabase.schema(this.config.schema).from(this.table).select('*');

			for (const [key, value] of Object.entries(queryData)) {
				query = query.filter(key, 'eq', value);
			}

			const res = await query;
			const result = this.runTransaction(
				{
					data: res.data as any,
					error: res.error
				},
				'array'
			).unwrap();

			return result.map((row) => this.Generator(row));
		};

		const paginateQuery = async (page: number, size: number) => {
			const from = (page - 1) * size;
			const to = from + size - 1;
			let query = this.supabase
				.schema(this.config.schema)
				.from(this.table)
				.select('*', { count: 'exact' })
				.range(from, to);

			for (const [key, value] of Object.entries(queryData)) {
				query = query.filter(key, 'eq', value);
			}

			const res = await query;
			const transactionResult = this.runTransaction(
				{
					data: res.data as any,
					error: res.error
				},
				'array'
			).unwrap();

			return {
				data: transactionResult.map((row) => this.Generator(row)),
				count: res.count ?? 0
			};
		};

		const newQuery = new SupaQuery(this, satisfies, allQuery, paginateQuery);
		this.queryCache.set(cacheKey, newQuery);
		return newQuery;
	}

	/**
	 * Fetches rows that satisfy any provided field/value pair.
	 *
	 * @param {Partial<Row<Schema, RowName>>} queryData - OR-style match criteria.
	 * @returns {SupaQuery<Schema, RowName>} Query wrapper with reactive and paginated access.
	 * @example
	 * const q = struct.getOR({ archived: true, severity: 'warn' } as Partial<Row<Schema, RowName>>);
	 */
	getOR(queryData: Partial<Row<Schema, RowName>>) {
		const cacheKey = `getOR:${JSON.stringify(queryData)}`;
		const cached = this.queryCache.get(cacheKey);
		if (cached) return cached;

		const entries = Object.entries(queryData);

		const satisfies = (data: SupaStructData<Schema, RowName>) =>
			entries.some(([key, value]) => data.raw[key as keyof Row<Schema, RowName>] === value);

		const allQuery = async () => {
			if (!entries.length) {
				return [];
			}
			let query = this.supabase.schema(this.config.schema).from(this.table).select('*');

			const orConditions = entries.map(([key, value]) => `${key}.eq.${value}`).join(',');

			query = query.or(orConditions);

			const res = await query;
			const result = this.runTransaction(
				{
					data: res.data as any,
					error: res.error
				},
				'array'
			).unwrap();

			return result.map((row) => this.Generator(row));
		};

		const paginateQuery = async (page: number, size: number) => {
			if (!entries.length) {
				return {
					data: [],
					count: 0
				};
			}
			const from = (page - 1) * size;
			const to = from + size - 1;
			let query = this.supabase
				.schema(this.config.schema)
				.from(this.table)
				.select('*', { count: 'exact' })
				.range(from, to);

			const orConditions = entries.map(([key, value]) => `${key}.eq.${value}`).join(',');

			query = query.or(orConditions);

			const res = await query;
			const transactionResult = this.runTransaction(
				{
					data: res.data as any,
					error: res.error
				},
				'array'
			).unwrap();

			return {
				data: transactionResult.map((row) => this.Generator(row)),
				count: res.count ?? 0
			};
		};

		const newQuery = new SupaQuery(this, satisfies, allQuery, paginateQuery);
		this.queryCache.set(cacheKey, newQuery);
		return newQuery;
	}

	/**
	 * Builds and executes nested AND/OR search predicates.
	 *
	 * @param {SearchQuery<Schema, RowName>} query - Recursive search descriptor.
	 * @returns {SupaQuery<Schema, RowName>} Query wrapper for full or paginated retrieval.
	 * @example
	 * const q = struct.search({ field: 'archived', operator: 'eq', value: false } as SearchQuery<Schema, RowName>);
	 */
	search(query: SearchQuery<Schema, RowName>) {
		const cacheKey = `search:${JSON.stringify(query)}`;
		const cached = this.queryCache.get(cacheKey);
		if (cached) return cached;

		const normalizePattern = (
			operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike',
			value: unknown
		) => {
			if ((operator === 'like' || operator === 'ilike') && typeof value === 'string') {
				if (!value.includes('%') && !value.includes('_')) {
					return `%${value}%`;
				}
			}
			return value;
		};

		const satisfies = (data: SupaStructData<Schema, RowName>): boolean => {
			const evaluate = (q: SearchQuery<Schema, RowName>): boolean => {
				if ('field' in q) {
					const fieldValue = data.raw[q.field];
					switch (q.operator) {
						case 'eq':
							return fieldValue === q.value;
						case 'neq':
							return fieldValue !== q.value;
						case 'gt':
							return fieldValue > q.value;
						case 'gte':
							return fieldValue >= q.value;
						case 'lt':
							return fieldValue < q.value;
						case 'lte':
							return fieldValue <= q.value;
						case 'like':
							return (
								typeof fieldValue === 'string' &&
								typeof q.value === 'string' &&
								fieldValue.includes(q.value)
							);
						case 'ilike':
							return (
								typeof fieldValue === 'string' &&
								typeof q.value === 'string' &&
								fieldValue.toLowerCase().includes(q.value.toLowerCase())
							);
						default:
							return false;
					}
				} else if ('type' in q) {
					if (q.type === 'and') {
						return q.conditions.every(evaluate);
					} else if (q.type === 'or') {
						return q.conditions.some(evaluate);
					}
				}
				return false;
			};
			return evaluate(query);
		};

		const main = this.supabase.schema(this.schema).from(this.table).select('*');

		const buildQuery = (base: typeof main, q: SearchQuery<Schema, RowName>): typeof main => {
			if ('field' in q) {
				return base.filter(String(q.field), q.operator, normalizePattern(q.operator, q.value));
			}
			if (q.type === 'and') {
				let current = base;
				for (const condition of q.conditions) {
					current = buildQuery(current, condition);
				}
				return current;
			}
			if (q.type === 'or') {
				const orConditions = q.conditions
					.map((condition) => {
						if ('field' in condition) {
							const value = normalizePattern(condition.operator, condition.value);
							return `${String(condition.field)}.${condition.operator}.${value}`;
						} else {
							throw new Error('Nested OR conditions are not supported');
						}
					})
					.join(',');
				return base.or(orConditions);
			}

			return base;
		};
		const allQuery = async () => {
			const queryBuilder = buildQuery(main, query);

			const res = await queryBuilder;
			const transactionResult = this.runTransaction(
				{
					data: res.data as any,
					error: res.error
				},
				'array'
			).unwrap();

			return transactionResult.map((row) => this.Generator(row));
		};

		const paginateQuery = async (page: number, size: number) => {
			const from = (page - 1) * size;
			const to = from + size - 1;

			const queryBuilder = buildQuery(
				this.supabase.schema(this.schema).from(this.table).select('*', { count: 'exact' }),
				query
			).range(from, to);

			const res = await queryBuilder;
			const transactionResult = this.runTransaction(
				{
					data: res.data as any,
					error: res.error
				},
				'array'
			).unwrap();

			return {
				data: transactionResult.map((row) => this.Generator(row)),
				count: res.count ?? 0
			};
		};

		const newQuery = new SupaQuery(this, satisfies, allQuery, paginateQuery);
		this.queryCache.set(cacheKey, newQuery);
		return newQuery;
	}

	/**
	 * Reads a single row by `id`.
	 *
	 * @param {string} id - Row primary key.
	 * @returns {ReturnType<typeof attemptAsync<SupaStructData<Schema, RowName>>>} Async result wrapper.
	 * @example
	 * const result = await struct.fromId('abc123');
	 */
	fromId(id: string) {
		return attemptAsync(async () => {
			const res = await this.supabase
				.schema(this.config.schema)
				.from(this.table)
				.select('*')
				.filter('id', 'eq', id)
				.single();
			const result = this.runTransaction(
				{
					data: res.data as any,
					error: res.error
				},
				'single'
			).unwrap();
			return this.Generator(result);
		});
	}

	/**
	 * Inserts a new row and returns the wrapped created row.
	 *
	 * @param {Insert<Schema, Extract<RowName, InsertTableNames<Schema>>>} data - Insert payload.
	 * @returns {ReturnType<typeof attemptAsync<SupaStructData<Schema, RowName>>>} Async result wrapper.
	 * @example
	 * const created = await struct.new({ id: '1' } as Insert<Schema, Extract<RowName, InsertTableNames<Schema>>>);
	 */
	new(...data: Insert<Schema, Extract<RowName, InsertTableNames<Schema>>>[]) {
		return attemptAsync(async () => {
			const res = await this.supabase
				.schema(this.config.schema)
				.from(this.table)
				.insert(data as any)
				.select('*');
			const result = this.runTransaction(
				{
					data: res.data as any,
					error: res.error
				},
				'array'
			).unwrap();
			return result.map((row) => this.Generator(row));
		});
	}

	/**
	 * Upserts a row and returns the wrapped resulting row.
	 *
	 * @param {Insert<Schema, Extract<RowName, InsertTableNames<Schema>>>} data - Upsert payload.
	 * @returns {ReturnType<typeof attemptAsync<SupaStructData<Schema, RowName>>>} Async result wrapper.
	 * @example
	 * const row = await struct.upsert({ id: '1' } as Insert<Schema, Extract<RowName, InsertTableNames<Schema>>>);
	 */
	upsert(data: Insert<Schema, Extract<RowName, InsertTableNames<Schema>>>) {
		return attemptAsync(async () => {
			const res = await this.supabase
				.schema(this.config.schema)
				.from(this.table)
				.upsert(data as any)
				.select('*')
				.single();
			const result = this.runTransaction(
				{
					data: res.data as any,
					error: res.error
				},
				'single'
			).unwrap();
			return this.Generator(result);
		});
	}

	/**
	 * Fetches all rows for the table.
	 *
	 * @returns {SupaQuery<Schema, RowName>} Query wrapper with full and paginated accessors.
	 * @example
	 * const q = struct.all();
	 * const rows = await q;
	 */
	all() {
		const cacheKey = `all`;
		const cached = this.queryCache.get(cacheKey);
		if (cached) return cached;

		const satisfies = (_: SupaStructData<Schema, RowName>) => true;

		const allQuery = async () => {
			const res = await this.supabase.schema(this.config.schema).from(this.table).select('*');
			const result = this.runTransaction(
				{
					data: res.data as any,
					error: res.error
				},
				'array'
			).unwrap();

			return result.map((row) => this.Generator(row));
		};

		const paginateQuery = async (page: number, size: number) => {
			const from = (page - 1) * size;
			const to = from + size - 1;
			const res = await this.supabase
				.schema(this.config.schema)
				.from(this.table)
				.select('*', { count: 'exact' })
				.range(from, to);
			const result = this.runTransaction(
				{
					data: res.data as any,
					error: res.error
				},
				'array'
			).unwrap();

			return {
				data: result.map((row) => this.Generator(row)),
				count: res.count ?? 0
			};
		};

		const newQuery = new SupaQuery(this, satisfies, allQuery, paginateQuery);
		this.queryCache.set(cacheKey, newQuery);
		return newQuery;
	}
}

/**
 * Recursive search descriptor used by `search`.
 *
 * Supports:
 * - Atomic predicates (`field`, `operator`, `value`).
 * - Composite predicates (`type: 'and' | 'or'`) with nested `conditions`.
 *
 * @template Name - Table name used to infer valid field keys and values.
 *
 * @example
 * const q: SearchQuery<'users'> = {
 *   type: 'or',
 *   conditions: [
 *     { field: 'email', operator: 'ilike', value: '%@example.com' },
 *     { field: 'role', operator: 'eq', value: 'admin' }
 *   ]
 * };
 */
export type SearchQuery<Schema extends RowSchemaName, Name extends RowTableNames<Schema>> =
	| {
			field: keyof Row<Schema, Name>;
			operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike';
			value: Row<Schema, Name>[keyof Row<Schema, Name>];
	  }
	| {
			type: 'and' | 'or';
			conditions: SearchQuery<Schema, Name>[];
	  };

// Define a type for the paginated response that includes the total count
type PaginatedResponse<T> = { data: T[]; count: number };

class SupaQuery<Schema extends RowSchemaName, RowName extends RowTableNames<Schema>> {
	private _paginatedInstance: SupaPagination<Schema, RowName> | null = null;

	// We can track a loading state if we want UI feedback
	private _loading = $state(false);

	/**
	 * Creates a query wrapper for table-scoped cached and remote reads.
	 *
	 * @param {SupaStruct<Schema, RowName>} struct - Owning struct.
	 * @param {(data: SupaStructData<Schema, RowName>) => boolean} satisfies - Client-side cache predicate.
	 * @param {() => Promise<SupaStructData<Schema, RowName>[]>} fetchAll - Full fetch function.
	 * @param {(page: number, size: number) => Promise<PaginatedResponse<SupaStructData<Schema, RowName>>>} paginateQuery - Paginated fetch function.
	 * @example
	 * const q = new SupaQuery(struct, () => true, fetchAll, paginate);
	 */
	constructor(
		private readonly struct: SupaStruct<Schema, RowName>,
		private readonly satisfies: (data: SupaStructData<Schema, RowName>) => boolean,
		private readonly fetchAll: () => Promise<SupaStructData<Schema, RowName>[]>,
		private readonly paginateQuery: (
			page: number,
			size: number
		) => Promise<PaginatedResponse<SupaStructData<Schema, RowName>>>
	) {}

	/**
	 * Returns a live filtered view of cached rows.
	 *
	 * @returns {SupaStructData<Schema, RowName>[]} Cached rows matching the query predicate.
	 * @example
	 * const rows = query.reactive;
	 */
	get reactive() {
		return Array.from(this.struct.cache.values()).filter(this.satisfies);
	}

	/**
	 * Returns or lazily creates the pagination controller for this query.
	 *
	 * @returns {SupaPagination<Schema, RowName>} Pagination state and controls.
	 * @example
	 * const page = query.paginated;
	 */
	get paginated() {
		if (!this._paginatedInstance) {
			this._paginatedInstance = new SupaPagination(this, this.struct, this.paginateQuery);
		}
		return this._paginatedInstance;
	}

	/**
	 * Enables promise-like usage (`await query`) to execute a full fetch.
	 *
	 * @param {(value: Result<SupaStructData<Schema, RowName>[], Error>) => void | PromiseLike<void> | null} [onfulfilled] - Fulfillment handler.
	 * @returns {Promise<Result<SupaStructData<Schema, RowName>[], Error>>} Query execution result.
	 * @example
	 * const result = await query;
	 */
	then(
		onfulfilled?:
			| ((value: Result<SupaStructData<Schema, RowName>[], Error>) => void | PromiseLike<void>)
			| null
	) {
		this._loading = true;
		return this.fetchAll()
			.then((res) => {
				this._loading = false;
				const result = new Ok(res);
				onfulfilled?.(result);
				return result;
			})
			.catch((err) => {
				this._loading = false;
				const result = new Err(err instanceof Error ? err : new Error(String(err))) as Result<
					SupaStructData<Schema, RowName>[],
					Error
				>;
				onfulfilled?.(result);
				return result;
			});
	}

	unwrap() {
		return this.then().then((res) => res.unwrap());
	}

	unwrapOr(defaultValue: SupaStructData<Schema, RowName>[]) {
		return this.then().then((res) => res.unwrapOr(defaultValue));
	}
}

class SupaPagination<Schema extends RowSchemaName, RowName extends RowTableNames<Schema>> {
	private _currentPage = $state(1);
	private _pageSize = $state(10);
	private _totalItems = $state(0);

	// Track exact IDs for the current view, solving the Cache-Slice mismatch
	private _currentPageIds = $state<string[]>([]);

	/**
	 * Creates a pagination controller bound to a query and struct cache.
	 *
	 * @param {SupaQuery<Schema, RowName>} query - Parent query wrapper.
	 * @param {SupaStruct<Schema, RowName>} struct - Owning struct.
	 * @param {(page: number, size: number) => Promise<PaginatedResponse<SupaStructData<Schema, RowName>>>} paginateQuery - Paginated fetch executor.
	 * @example
	 * const pager = new SupaPagination(query, struct, paginate);
	 */
	constructor(
		private readonly query: SupaQuery<Schema, RowName>,
		private readonly struct: SupaStruct<Schema, RowName>,
		private readonly paginateQuery: (
			page: number,
			size: number
		) => Promise<PaginatedResponse<SupaStructData<Schema, RowName>>>
	) {}

	/**
	 * Current page index (1-based).
	 *
	 * @returns {number} Current page number.
	 * @example
	 * console.log(pager.currentPage);
	 */
	get currentPage() {
		return this._currentPage;
	}

	/**
	 * Current page size.
	 *
	 * @returns {number} Number of rows per page.
	 * @example
	 * console.log(pager.pageSize);
	 */
	get pageSize() {
		return this._pageSize;
	}

	/**
	 * Updates page size and resets to page 1.
	 *
	 * @param {number} value - New page size.
	 * @example
	 * pager.pageSize = 25;
	 */
	set pageSize(value: number) {
		this._pageSize = value;
		this._currentPage = 1;
		this.executeFetch();
	}

	/**
	 * Total matching item count for the last paginated request.
	 *
	 * @returns {number} Total number of matching rows.
	 * @example
	 * console.log(pager.totalItems);
	 */
	get totalItems() {
		return this._totalItems;
	}

	/**
	 * Total page count based on `totalItems` and `pageSize`.
	 *
	 * @returns {number} Total page count.
	 * @example
	 * console.log(pager.pages);
	 */
	get pages() {
		return Math.ceil(this._totalItems / this._pageSize) || 1;
	}

	/**
	 * Reactive rows currently visible for the selected page.
	 *
	 * @returns {SupaStructData<Schema, RowName>[]} Current page rows from cache.
	 * @example
	 * const rows = pager.reactive;
	 */
	get reactive(): SupaStructData<Schema, RowName>[] {
		return this._currentPageIds
			.map((id) => this.struct.cache.get(id))
			.filter((item): item is SupaStructData<Schema, RowName> => !!item);
	}

	/**
	 * Indicates whether a next page exists.
	 *
	 * @returns {boolean} True when current page is below total pages.
	 * @example
	 * if (pager.hasNext) await pager.next();
	 */
	get hasNext() {
		return this._currentPage < this.pages;
	}
	/**
	 * Indicates whether a previous page exists.
	 *
	 * @returns {boolean} True when current page is greater than 1.
	 * @example
	 * if (pager.hasPrev) await pager.prev();
	 */
	get hasPrev() {
		return this._currentPage > 1;
	}

	/**
	 * Moves to the next page and fetches data.
	 *
	 * @returns {Promise<Result<SupaStructData<Schema, RowName>[], Error>>} Page fetch result.
	 * @example
	 * await pager.next();
	 */
	next() {
		if (this.hasNext) {
			this._currentPage++;
			return this.executeFetch();
		}
		return Promise.resolve(new Ok([])); // Return empty Ok if no next page
	}

	/**
	 * Moves to the previous page and fetches data.
	 *
	 * @returns {Promise<Result<SupaStructData<Schema, RowName>[], Error>>} Page fetch result.
	 * @example
	 * await pager.prev();
	 */
	prev() {
		if (this.hasPrev) {
			this._currentPage--;
			return this.executeFetch();
		}
		return Promise.resolve(new Ok([]));
	}

	/**
	 * Moves to a specific page and fetches data.
	 *
	 * @param {number} num - Target page (1-based).
	 * @returns {Promise<Result<SupaStructData<Schema, RowName>[], Error>>} Page fetch result.
	 * @example
	 * await pager.page(3);
	 */
	page(num: number) {
		if (num >= 1 && num <= this.pages) {
			this._currentPage = num;
			return this.executeFetch();
		}
		return Promise.resolve(new Ok([]));
	}

	/**
	 * Reusable fetch logic that correctly updates the ID list and total count.
	 *
	 * @returns {Promise<Result<SupaStructData<Schema, RowName>[], Error>>} Page fetch result.
	 * @example
	 * const result = await this.executeFetch();
	 */
	private executeFetch() {
		return this.paginateQuery(this._currentPage, this._pageSize)
			.then((res) => {
				this._totalItems = res.count;

				// Only track the IDs for this specific page slice
				this._currentPageIds = res.data.map((item) => String(item.raw.id));

				return new Ok(res.data);
			})
			.catch((err) => {
				return new Err(err instanceof Error ? err : new Error(String(err))) as Result<
					SupaStructData<Schema, RowName>[],
					Error
				>;
			});
	}

	/**
	 * Executing `await query.paginated` fetches the current page.
	 *
	 * @param {(value: Result<SupaStructData<Schema, RowName>[], Error>) => void | PromiseLike<void> | null} [onfulfilled] - Fulfillment handler.
	 * @returns {Promise<Result<SupaStructData<Schema, RowName>[], Error>>} Pagination result.
	 * @example
	 * const result = await query.paginated;
	 */
	then(
		onfulfilled?:
			| ((value: Result<SupaStructData<Schema, RowName>[], Error>) => void | PromiseLike<void>)
			| null
	) {
		return this.executeFetch().then(onfulfilled);
	}
}

export class SupaStructData<
	Schema extends RowSchemaName,
	RowName extends RowTableNames<Schema>,
	UpdateName extends UpdateTableNames<Schema> = Extract<RowName, UpdateTableNames<Schema>>
> {
	public readonly raw: Row<Schema, RowName> = $state({} as any);

	/**
	 * Creates a wrapped row instance tied to a parent struct.
	 *
	 * @param {SupaStruct<Schema, RowName>} struct - Parent struct.
	 * @param {Row<Schema, RowName>} data - Initial row data.
	 * @example
	 * const item = new SupaStructData(struct, row);
	 */
	constructor(
		public readonly struct: SupaStruct<Schema, RowName>,
		data: Row<Schema, RowName>
	) {
		this.raw = data;
	}

	/**
	 * Row id convenience accessor.
	 *
	 * @returns {string} Row id.
	 * @example
	 * console.log(item.id);
	 */
	get id() {
		return this.raw.id;
	}

	/**
	 * Row creation timestamp as a reactive `SvelteDate`.
	 *
	 * @returns {SvelteDate} Reactive date wrapper.
	 * @example
	 * console.log(item.created.toISOString());
	 */
	get created() {
		return new SvelteDate(this.raw.created_at);
	}

	/**
	 * Row archival state convenience accessor.
	 *
	 * @returns {boolean} Archival state.
	 * @example
	 * if (!item.archived) { console.log('active'); }
	 */
	get archived() {
		return this.raw.archived;
	}

	/**
	 * Updates this row in Supabase and merges the returned row into local state.
	 *
	 * @param {Partial<Insert<Schema, UpdateName>>} updates - Patch payload.
	 * @returns {ReturnType<typeof attemptAsync<SupaStructData<Schema, RowName>>>} Async result wrapper.
	 * @example
	 * await item.update({ archived: true });
	 */
	update(updates: Partial<Insert<Schema, UpdateName>>) {
		return attemptAsync(async () => {
			const res = await this.struct.supabase
				.schema(this.struct.schema)
				.from(this.struct.table)
				.update(updates as any)
				.filter('id', 'eq', this.id)
				.select('*')
				.single();

			const result = this.struct
				.runTransaction(
					{
						data: res.data as any,
						error: res.error
					},
					'single'
				)
				.unwrap();
			Object.assign(this.raw as any, result);
			return this;
		});
	}

	/**
	 * Deletes this row from Supabase.
	 *
	 * @returns {ReturnType<typeof attemptAsync<boolean>>} Async result wrapper.
	 * @example
	 * await item.delete();
	 */
	delete() {
		return attemptAsync(async () => {
			const res = await this.struct.supabase
				.schema(this.struct.schema)
				.from(this.struct.table)
				.delete()
				.filter('id', 'eq', this.id);

			this.struct
				.runTransaction(
					{
						data: res.data as any,
						error: res.error
					},
					'null'
				)
				.unwrap();
			this.struct.cache.delete(String(this.id));
			return true;
		});
	}
}
