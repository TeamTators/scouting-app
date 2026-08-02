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
import { attempt, attemptAsync, ComplexEventEmitter, type Result, Ok, Err, Stream } from 'ts-utils';
import { REALTIME_SUBSCRIBE_STATES, type SupabaseClient } from '@supabase/supabase-js';
import { schemas } from '$lib/types/supabase-zod';
import { z } from 'zod';
import { type Database, type DatabasePivoted, type SchemaName } from '$lib/types/supabase';
import { SvelteMap, SvelteDate, SvelteSet } from 'svelte/reactivity';
import { browser } from '$app/environment';
import { DexieTable } from '$lib/services/db/table';
import { is_online, on_network_change } from '$lib/utils/online.svelte';
import { stable_stringify } from '$lib/utils/json';

export type Client = SupabaseClient<Database> & { serviceRole: boolean };

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

export type RowWithoutArchived<
	Schema extends SchemaName,
	Name extends RowTableNames<Schema>
> = Omit<Row<Schema, Name>, 'archived'>;

export type Insert<
	Schema extends SchemaName,
	Name extends InsertTableNames<Schema>
> = DatabasePivoted['Insert'][Schema][Name];

export type InsertWithoutArchived<
	Schema extends SchemaName,
	Name extends InsertTableNames<Schema>
> = Omit<Insert<Schema, Name>, 'archived'>;

export type Update<
	Schema extends SchemaName,
	Name extends UpdateTableNames<Schema>
> = DatabasePivoted['Update'][Schema][Name] & {
	archived?: boolean;
};

export type UpdateWithoutArchived<
	Schema extends SchemaName,
	Name extends UpdateTableNames<Schema>
> = Omit<Update<Schema, Name>, 'archived' | 'id' | 'created_at'>;

export type PartialRow<
	Schema extends SchemaName,
	Name extends RowTableNames<Schema>,
	RequiredFields extends keyof RowWithoutArchived<Schema, Name> = keyof RowWithoutArchived<
		Schema,
		Name
	>
> = Partial<RowWithoutArchived<Schema, Name>> & {
	[K in RequiredFields]: RowWithoutArchived<Schema, Name>[K];
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
 * @property do_set - Set the struct in the cache (default true)
 */
export type SupaConfig<Schema extends RowSchemaName, Name extends RowTableNames<Schema>> = {
	table: Name;
	client: Client;
	schema: Schema;
	debug?: boolean;
	index_db?: boolean;
	do_set?: boolean;
};

export type RequiredList<
	Schema extends RowSchemaName,
	Name extends RowTableNames<Schema>
> = readonly (keyof Row<Schema, Name>)[];

export type ResolveRequiredFields<
	Schema extends RowSchemaName,
	Name extends RowTableNames<Schema>,
	Required extends RequiredList<Schema, Name> | undefined
> = Required extends readonly (infer K)[]
	? Extract<K, keyof Row<Schema, Name>> | 'id'
	: keyof Row<Schema, Name>;

export type HasAtLeastRequiredFields<Have extends PropertyKey, Need extends PropertyKey> = [
	Need
] extends [Have]
	? true
	: false;

export type EnsureHasAtLeastRequiredFields<Have extends PropertyKey, Need extends PropertyKey> = [
	Need
] extends [Have]
	? Have
	: never;

export type ReadConfig<
	Schema extends RowSchemaName,
	Name extends RowTableNames<Schema>,
	Required extends keyof RowWithoutArchived<Schema, Name> = keyof RowWithoutArchived<Schema, Name>
> = {
	only?: readonly Required[];
};

export type SupaErrorCode =
	| 'invalid data'
	| 'no schema'
	| 'no table'
	| 'unauthorized'
	| 'unknown'
	| 'network'
	| 'timeout'
	| 'offline';

class SupaError extends Error {
	constructor(
		public readonly code: SupaErrorCode,
		message?: string
	) {
		super(message ?? `SupaStruct query error: ${code}`);
	}
}

const OfflineUpdates = new DexieTable({
	name: 'offline_updates',
	schema: z.object({
		action: z.enum(['insert', 'update', 'delete', 'upsert']),
		data: z.record(z.any()),
		schema: z.string(),
		table: z.string(),
		target_id: z.string().optional()
	})
});

const QUERY_CACHE_VERSION = 1;
const QueryCache = new DexieTable({
	name: 'queries',
	schema: z.object({
		query: z.string(),
		schema: z.string(),
		table: z.string(),
		version: z.number(),
		required: z.string(),
		last_sync: z.number()
	})
});

let offline_setup = false;

const is_test_runtime = () => {
	if (typeof process === 'undefined') return false;
	return process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';
};

export const setup_network_listener = (client: Client) => {
	if (offline_setup)
		return () => {
			offline_setup = false;
		};
	offline_setup = true;
	const off = on_network_change(async (online) => {
		if (!online) return;
		const updates = await OfflineUpdates.all();

		if (updates.isErr()) {
			console.error('Failed to load offline updates', updates.error);
			return;
		}

		for (const update of updates.value.slice()) {
			const struct = SupaStruct.get({
				client,
				schema: update.raw.schema as RowSchemaName,
				table: update.raw.table as RowTableNames<RowSchemaName>
			});
			if (update.raw.action === 'insert') {
				if (!Array.isArray(update.raw.data)) {
					console.error('Offline insert data is not an array', update.raw);
					await update.delete();
					continue;
				}
				const result = await struct.new(...(update.raw.data as never[]));
				if (result.isErr()) {
					console.error('Failed to process offline insert', result.error);
					continue;
				} else {
					await update.delete();
					continue;
				}
			}

			if (update.raw.action === 'upsert') {
				if (!Array.isArray(update.raw.data)) {
					console.error('Offline upsert data is not an array', update.raw);
					await update.delete();
					continue;
				}
				const result = await struct.upsert(update.raw.data as never[]);
				if (result.isErr()) {
					console.error('Failed to process offline upsert', result.error);
					continue;
				} else {
					await update.delete();
					continue;
				}
			}

			if (!('id' in update.raw.data)) {
				console.error('Offline update missing id field', update.raw);
				await update.delete();
				continue;
			}

			const data = await struct.fromId(update.raw.data.id as string);
			if (data.isErr()) {
				console.error('Failed to load existing row for offline update', data.error);
				continue;
			}

			if (!data.value) {
				console.error('Offline update could not find existing row', update.raw);
				await update.delete();
				continue;
			}

			if (update.raw.action === 'update') {
				const result = await data.value.update(update.raw.data as never);
				if (result.isErr()) {
					console.error('Failed to process offline update', result.error);
					continue;
				} else {
					await update.delete();
					continue;
				}
			}
			if (update.raw.action === 'delete') {
				const result = await data.value.delete();
				if (result.isErr()) {
					console.error('Failed to process offline delete', result.error);
					continue;
				} else {
					await update.delete();
					continue;
				}
			}
		}
	});
	return () => {
		off();
		offline_setup = false;
	};
};

export class SupaStruct<Schema extends RowSchemaName, RowName extends RowTableNames<Schema>> {
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	public static readonly structs = new Map<
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
		const existing = SupaStruct.structs.get(`${config.schema}.${String(config.table)}`);
		if (existing) return existing as unknown as SupaStruct<Schema, Name>;
		const instance = new SupaStruct(config);
		if ((browser || config.client.serviceRole) && config.do_set !== false) {
			if (config.debug) instance.log('Caching struct for table', config.table);
			SupaStruct.structs.set(`${config.schema}.${String(config.table)}`, instance as any);
		}
		try {
			instance.ensurePerStructRealtimeSubscription();
			instance.initializeCache();
		} catch {
			//
		}
		return instance;
	}

	private static _initializedRealtime = false;

	public static initRealtime(client: Client) {
		if (is_test_runtime()) return () => {};
		if (SupaStruct._initializedRealtime) return () => {};
		SupaStruct._initializedRealtime = true;
		const channel = client.channel('postgres_changes');
		channel
			.on('postgres_changes', { event: '*', schema: '*', table: '*' }, (payload) => {
				const struct = SupaStruct.structs.get(`${payload.schema}.${payload.table}`) as
					| SupaStruct<any, any>
					| undefined;
				if (struct) {
					struct.handleRealtimePayload(payload);
				}
			})
			.subscribe((status) => {
				SupaStruct.structs.forEach((struct) => {
					struct.log('Realtime subscription status:', status);
					struct.em.emit('realtime', status);
				});
			});

		return () => {
			channel.unsubscribe();
		};
	}

	public readonly cache = $state(new SvelteMap<string, SupaStructData<Schema, RowName, 'id'>>());
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

	/**
	 * Creates a typed table struct.
	 *
	 * @param {SupaConfig<Schema, RowName>} config - Runtime table, schema, and client configuration.
	 * @example
	 * const profiles = new SupaStruct({ schema: 'core', table: 'profile', client: supabase });
	 */
	constructor(public readonly config: SupaConfig<Schema, RowName>) {}

	private readonly _seenRealtimeEvents = new SvelteMap<string, number>();
	private _perStructRealtimeSubscribed = false;

	private set_in_cache(data: SupaStructData<Schema, RowName, 'id'>) {
		if (
			!this.supabase.serviceRole &&
			browser &&
			this.config.do_set !== false &&
			this.config.index_db !== false
		) {
			this.cache.set(data.raw.id, data);
		}
	}

	private getRealtimeEventKey(payload: {
		eventType?: string;
		schema?: string;
		table?: string;
		commit_timestamp?: string;
		new?: Record<string, unknown>;
		old?: Record<string, unknown>;
	}) {
		return [
			payload.schema ?? String(this.schema),
			payload.table ?? String(this.table),
			payload.eventType ?? 'unknown',
			payload.commit_timestamp ?? 'no_ts',
			String(payload.new?.id ?? payload.old?.id ?? 'no_id')
		].join('|');
	}

	private shouldProcessRealtimePayload(payload: {
		eventType?: string;
		schema?: string;
		table?: string;
		commit_timestamp?: string;
		new?: Record<string, unknown>;
		old?: Record<string, unknown>;
	}) {
		const now = Date.now();
		for (const [key, seenAt] of this._seenRealtimeEvents) {
			if (now - seenAt > 10000) {
				this._seenRealtimeEvents.delete(key);
			}
		}

		const key = this.getRealtimeEventKey(payload);
		const existing = this._seenRealtimeEvents.get(key);
		if (existing && now - existing < 10000) {
			return false;
		}

		this._seenRealtimeEvents.set(key, now);
		return true;
	}

	private handleRealtimePayload(payload: {
		eventType?: string;
		new?: Record<string, unknown>;
		old?: Record<string, unknown>;
		schema?: string;
		table?: string;
		commit_timestamp?: string;
	}) {
		if (!this.shouldProcessRealtimePayload(payload)) {
			this.log('Skipping duplicate realtime payload');
			return;
		}

		this.log('Received realtime payload:', payload);
		switch (payload.eventType) {
			case 'INSERT': {
				if (!payload.new) return;
				const data = this.Generator(payload.new as any);
				this.em.emit('new', data as any);
				break;
			}
			case 'UPDATE': {
				if (!payload.new) return;
				const updated = this.Generator(payload.new as any);
				this.em.emit('update', updated as any, (payload.old ?? {}) as any);
				break;
			}
			case 'DELETE': {
				const id = String(payload.old?.id ?? '');
				if (!id) return;
				const existing = this.cache.get(id);
				if (existing) {
					this.em.emit('delete', existing as any);
				}
				this.cache.delete(id);
				break;
			}
		}
	}

	private ensurePerStructRealtimeSubscription() {
		if (!browser) return;
		if (is_test_runtime()) return;
		if (this._perStructRealtimeSubscribed) return;
		this._perStructRealtimeSubscribed = true;

		const channel = this.supabase.channel(
			`postgres_changes:${String(this.schema)}.${String(this.table)}`
		);

		channel
			.on(
				'postgres_changes',
				{ event: '*', schema: String(this.schema), table: String(this.table) },
				(payload) => {
					this.handleRealtimePayload(payload as any);
				}
			)
			.subscribe((status) => {
				this.log('Per-struct realtime subscription status:', status);
				this.em.emit('realtime', status);
			});
	}

	private _initializedCache = false;
	private initializeCache() {
		if (this._initializedCache) return;
		if (!this.config.index_db) return;
		this.log('Initializing cache for table', this.table, 'from IndexedDB');
		this._initializedCache = true;
		const dexie = this.getDexie(this.getSchemaDefinition().Row as any, false);
		if (dexie) {
			this.log('Initializing cache from IndexedDB for table', this.table);
		}
	}

	private getSchemaDefinition(): {
		Row: z.ZodObject<z.ZodRawShape>;
	} {
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
		return schema;
	}

	private getSchemaRowKeys(): (keyof RowWithoutArchived<Schema, RowName>)[] {
		const schema = this.getSchemaDefinition();
		const rowSchema = schema.Row as any;
		const shape = rowSchema?.shape;
		if (!shape || typeof shape !== 'object') {
			return ['id'];
		}

		const required = Object.keys(shape).filter((k) => {
			if (k === 'archived') return false;
			if (k === 'id') return true;

			const fieldSchema = shape[k] as any;
			const isOptional =
				typeof fieldSchema?.isOptional === 'function' ? fieldSchema.isOptional() : false;
			const isNullable =
				typeof fieldSchema?.isNullable === 'function' ? fieldSchema.isNullable() : false;

			return !isOptional && !isNullable;
		});

		if (!required.includes('id')) {
			required.unshift('id');
		}

		return required as (keyof RowWithoutArchived<Schema, RowName>)[];
	}

	private getEffectiveRequiredFields<Required extends keyof RowWithoutArchived<Schema, RowName>>(
		required?: readonly Required[]
	): (Required | 'id')[] | (keyof RowWithoutArchived<Schema, RowName>)[] {
		if (!required) {
			return this.getSchemaRowKeys();
		}

		if (!required.length) {
			return ['id'];
		}

		const normalized = required.map((field) => String(field));
		if (!normalized.includes('id')) {
			normalized.push('id');
		}
		return normalized as (Required | 'id')[];
	}

	private buildSelectClause<Required extends keyof RowWithoutArchived<Schema, RowName>>(
		required?: readonly Required[]
	) {
		if (!required) {
			return '*';
		}
		const fields = this.getEffectiveRequiredFields(required);
		return fields.map((field) => String(field)).join(',');
	}

	private toPostgrestLiteral(value: unknown) {
		if (value === null) return 'null';
		if (typeof value === 'number' || typeof value === 'boolean') {
			return String(value);
		}

		const str = typeof value === 'string' ? value : JSON.stringify(value);
		return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
	}

	private getDexie(schema: z.ZodType<RowWithoutArchived<Schema, RowName>>, initialize = false) {
		if (this.config.index_db === false) return;
		if (initialize) {
			this.initializeCache();
		}
		if (browser) {
			return DexieTable.get({
				name: `v1.${this.config.schema}.${String(this.config.table)}`,
				schema: schema,
				debug: this.config.debug
			});
		}
	}

	/**
	 * Validates a raw Supabase transaction payload against an expected cardinality.
	 *
	 * @param transaction - Response payload containing `data` and `error`.
	 * @param expect - Expected result shape (`array`, `single`, or `null`).
	 * @returns A `Result` wrapping typed data or an error.
	 */
	runTransaction<
		Required extends keyof RowWithoutArchived<Schema, RowName> = keyof RowWithoutArchived<
			Schema,
			RowName
		>
	>(
		transaction: {
			data: RowWithoutArchived<Schema, RowName>[] | RowWithoutArchived<Schema, RowName> | null;
			error: Error | null;
		},
		expect: 'array',
		required?: readonly Required[]
	): Result<PartialRow<Schema, RowName, Required>[], SupaError>;
	runTransaction<
		Required extends keyof RowWithoutArchived<Schema, RowName> = keyof RowWithoutArchived<
			Schema,
			RowName
		>
	>(
		transaction: {
			data: RowWithoutArchived<Schema, RowName>[] | RowWithoutArchived<Schema, RowName> | null;
			error: Error | null;
		},
		expect: 'single',
		required?: readonly Required[]
	): Result<PartialRow<Schema, RowName, Required>, SupaError>;
	runTransaction(
		transaction: {
			data: RowWithoutArchived<Schema, RowName>[] | RowWithoutArchived<Schema, RowName> | null;
			error: Error | null;
		},
		expect: 'null'
	): Result<null, SupaError>;
	runTransaction<
		Required extends keyof RowWithoutArchived<Schema, RowName> = keyof RowWithoutArchived<
			Schema,
			RowName
		>
	>(
		transaction: {
			data: RowWithoutArchived<Schema, RowName>[] | RowWithoutArchived<Schema, RowName> | null;
			error: Error | null;
		},
		expect: 'array' | 'single' | 'null',
		required?: readonly Required[]
	): Result<
		PartialRow<Schema, RowName, Required>[] | PartialRow<Schema, RowName, Required> | null,
		SupaError
	> {
		return attempt(() => {
			if (transaction.error) {
				this.log('Transaction error:', transaction.error);
				if (
					transaction.error.message.includes('permission denied') ||
					transaction.error.message.includes('rls')
				) {
					throw new SupaError('unauthorized', `Permission denied: ${transaction.error.message}`);
				} else {
					throw new SupaError('unknown', `Unknown error: ${transaction.error.message}`);
				}
			}

			const requiredFields = this.getEffectiveRequiredFields(required);

			const validate = (item: unknown) => {
				if (item === null || typeof item !== 'object') {
					this.log('Expected array of objects, received item of type', typeof item);
					throw new Error(`Expected an object but got ${typeof item}`);
				}
				for (const field of requiredFields) {
					if (!(field in item)) {
						this.log(`Missing required field ${String(field)} in item`, item);
						throw new Error(`Expected field ${String(field)} is missing in item`);
					}
				}
			};

			if (expect === 'array') {
				if (!Array.isArray(transaction.data)) {
					this.log('Expected array, received', typeof transaction.data);
					throw new SupaError(
						'invalid data',
						`Expected an array but got ${typeof transaction.data}`
					);
				}
				for (const item of transaction.data) validate(item);
				return transaction.data;
			} else if (expect === 'single') {
				if (Array.isArray(transaction.data)) {
					this.log('Expected single object, received array');
					throw new SupaError('invalid data', `Expected a single object but got an array`);
				}
				if (transaction.data === null) {
					this.log('Expected single object, received null');
					throw new SupaError('invalid data', `Expected a single object but got null`);
				}
				validate(transaction.data);
				this.log('Transaction successful with single result:', transaction.data);
				return transaction.data;
			} else {
				// expect === 'null'
				if (transaction.data !== null) {
					this.log('Expected null, received', typeof transaction.data);
					throw new SupaError('invalid data', `Expected null but got ${typeof transaction.data}`);
				}
				this.log('Transaction successful with null result');
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
	get table(): Extract<RowName, string> {
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
			console.log(`[SupaStruct:${this.table}] (${new SvelteDate().toISOString()})`, ...args);
		}
	}

	/**
	 * Validates input against the generated zod row schema for this table.
	 *
	 * @param {unknown} data - Unknown payload to validate.
	 * @returns {RowWithoutArchived<Schema, RowName>} Parsed row-like object
	 * @throws If the table schema is missing or parsing fails.
	 * @example
	 * const row = struct['validate'](payload);
	 */
	private validate<
		Required extends keyof RowWithoutArchived<Schema, RowName> = keyof RowWithoutArchived<
			Schema,
			RowName
		>
	>(data: unknown, required?: readonly Required[]): PartialRow<Schema, RowName, Required> {
		const schema = this.getSchemaDefinition();
		const parseResult = schema.Row.partial().safeParse(data);
		if (!parseResult.success) {
			throw new SupaError(
				'invalid data',
				`Failed to validate data for table ${this.table}: ` + parseResult.error.message
			);
		}

		const requiredFields = this.getEffectiveRequiredFields(required);

		for (const field of requiredFields) {
			const nullable = (schema.Row.shape as any)[field]?.isNullable() ?? false;
			if (!nullable && !(field in parseResult.data)) {
				console.warn(
					`Validated data for table ${this.table} is missing required field ${String(field)}`,
					{
						data: parseResult.data,
						requiredFields
					}
				);
				// throw new SupaError(
				// 	'invalid data',
				// 	`Validated data for table ${this.table} is missing required field ${String(field)}`
				// );
			}
		}
		return parseResult.data as PartialRow<Schema, RowName, Required>;
	}

	/**
	 * Normalizes a row payload into a cached `SupaStructData` instance.
	 *
	 * @param {RowWithoutArchived<Schema, RowName>} row - Raw or typed row payload.
	 * @returns {SupaStructData<Schema, RowName>} Stable row wrapper.
	 * @example
	 * const wrapped = struct.Generator(rawRow);
	 */
	Generator<
		Required extends keyof RowWithoutArchived<Schema, RowName> = keyof RowWithoutArchived<
			Schema,
			RowName
		>
	>(
		row: PartialRow<Schema, RowName, Required>,
		config?: { required?: readonly Required[]; cache?: boolean }
	): SupaStructData<Schema, RowName, Required | 'id'> {
		this.log('Generating struct data for row with id', row.id);
		const effectiveRequired = this.getEffectiveRequiredFields(config?.required);
		const validated = this.validate<Required | 'id'>(
			row,
			effectiveRequired as readonly (Required | 'id')[]
		);
		const exists = this.cache.get(String(validated.id));
		if (exists) {
			this.log(`Cache hit for row with id ${validated.id}`);
			// update existing cache instance with any new data
			Object.assign(exists.raw as any, row); // apply row updates so that other things that require more aren't broken by missing fields, but keep the existing instance to preserve references and reactivity
			// trigger reactivity by replacing the cache entry
			this.cache.delete(String(validated.id));
			this.set_in_cache(exists);
			return exists as unknown as SupaStructData<Schema, RowName, Required | 'id'>;
		}

		// using the unvalidated row here because the validated type is only guaranteed to have the required fields, but the cache instance needs to be able to access all fields. The validate method will throw if any required fields are missing, so this should be safe as long as the struct is used consistently with its validation guarantees.
		const rowData = new SupaStructData<Schema, RowName, Required | 'id'>(this, row as any);
		this.set_in_cache(rowData);
		return rowData;
	}

	Hydrate<
		Required extends keyof RowWithoutArchived<Schema, RowName> =
			| 'id'
			| keyof RowWithoutArchived<Schema, RowName>
	>(
		rows: PartialRow<Schema, RowName, Required | 'id'>[],
		required?: readonly Required[],
		satisfies?: (data: SupaStructData<Schema, RowName, Required | 'id'>) => boolean
	) {
		this.log(`Hydrating ${rows.length} rows into cache for table ${this.table}`, rows);
		const hydrated = rows.map((row) => this.Generator(row, { required }));

		if (satisfies) {
			// if a value is in the cache and satisfies the provided function but is not in the hydrated results, remove it from the cache
			const hydratedIds = new SvelteSet(hydrated.map((data) => String(data.raw.id)));
			for (const [id, data] of this.cache) {
				if (satisfies(data as any) && !hydratedIds.has(id)) {
					this.log(`Removing stale cache entry with id ${id} for table ${this.table}`);
					this.cache.delete(id);
				}
			}
		}

		const dexie = this.getDexie(this.getSchemaDefinition().Row as any);
		if (dexie) {
			const now = Date.now();
			const rowsForDexie = rows.map((row) => {
				const raw = row as Record<string, unknown>;
				const rowHydratedAt = typeof raw._hydrated_at === 'number' ? raw._hydrated_at : now;
				const rowTtl = typeof raw._ttl === 'number' ? raw._ttl : 0;
				return {
					...raw,
					_hydrated_at: rowHydratedAt,
					...(rowTtl > 0 ? { _ttl: rowTtl } : {})
				};
			});

			this.log(`Upserting ${hydrated.length} rows into IndexedDB for table ${this.table}`);
			// upsert into IndexedDB
			dexie
				.bulkUpsert(rowsForDexie as any)
				.then((res) => {
					if (res.isOk()) {
						this.log(`Upserted ${res.value} rows into IndexedDB for table ${this.table}`);
					} else {
						this.log('Error upserting rows into IndexedDB:', res.error);
					}
				})
				.finally(() => {
					this.log(
						`Finished upserting ${hydrated.length} rows into IndexedDB for table ${this.table}`
					);
				});
		}

		return hydrated;
	}

	join<
		OtherSchema extends RowSchemaName,
		OtherRowName extends RowTableNames<OtherSchema>,
		RequiredA extends keyof RowWithoutArchived<Schema, RowName> = keyof RowWithoutArchived<
			Schema,
			RowName
		>,
		RequiredB extends keyof RowWithoutArchived<OtherSchema, OtherRowName> =
			keyof RowWithoutArchived<OtherSchema, OtherRowName>
	>(
		other: SupaStruct<OtherSchema, OtherRowName>,
		config?: {
			requiredA?: readonly RequiredA[];
			whereB?: Partial<RowWithoutArchived<OtherSchema, OtherRowName>>;
			joinOn?: {
				left: keyof RowWithoutArchived<Schema, RowName>;
				right: keyof RowWithoutArchived<OtherSchema, OtherRowName>;
			};
		} & (
			| {
					pullB?: true;
					requiredB?: readonly RequiredB[];
			  }
			| {
					pullB: false;
					requiredB?: never;
			  }
		)
	): SupaQuery<Schema, RowName, RequiredA | 'id'> {
		if (String(this.schema) !== String(other.schema)) {
			throw new Error(
				`Cannot join tables from different schemas: ${this.schema} and ${other.schema}`
			);
		}
		const pullB = config?.pullB ?? true;
		const whereB = config?.whereB ?? {};

		const requiredA = this.getEffectiveRequiredFields(config?.requiredA) as readonly (
			| RequiredA
			| 'id'
		)[];
		const requiredB = other.getEffectiveRequiredFields(config?.requiredB) as readonly (
			| RequiredB
			| 'id'
		)[];

		// Ensure selected fields include id for stable hydration.
		const requiredAWithJoin = (() => {
			const list = requiredA.map((f) => String(f));
			if (!list.includes('id')) list.push('id');
			return list;
		})();
		const requiredBWithJoin = (() => {
			const list = requiredB.map((f) => String(f));
			for (const key of Object.keys(whereB)) {
				if (!list.includes(key)) list.push(key);
			}
			if (!list.includes('id')) list.push('id');
			return list;
		})();
		const requiredBForSelect = pullB
			? requiredBWithJoin
			: ['id', ...Object.keys(whereB).map(String)];

		const selectA = requiredAWithJoin.map((field) => String(field)).join(',');
		const selectB = requiredBForSelect.map((field) => String(field)).join(',');
		const matchedLeftIds = new SvelteSet<string>();

		const resolveJoinFields = () => {
			if (config?.joinOn) {
				return {
					left: String(config.joinOn.left),
					right: String(config.joinOn.right)
				};
			}

			const leftKeys = new SvelteSet(this.getSchemaRowKeys().map((k) => String(k)));
			const rightKeys = new SvelteSet(other.getSchemaRowKeys().map((k) => String(k)));

			const candidates: Array<{ left: string; right: string }> = [
				{ left: 'id', right: `${String(this.table)}_id` },
				{ left: 'id', right: `${String(this.table)}Id` },
				{ left: 'number', right: `${String(this.table)}_number` },
				{ left: 'number', right: `${String(this.table)}Number` },
				{ left: 'number', right: 'team_number' },
				{ left: 'id', right: 'id' }
			];

			for (const candidate of candidates) {
				if (leftKeys.has(candidate.left) && rightKeys.has(candidate.right)) {
					return candidate;
				}
			}

			return null;
		};

		const uniqueById = <T extends { id?: string }>(rows: T[]) => {
			const byId = new SvelteMap<string, T>();
			for (const row of rows) {
				if (!row?.id) continue;
				byId.set(String(row.id), row);
			}
			return Array.from(byId.values());
		};

		const setMatchedLeftIds = (leftRows: PartialRow<Schema, RowName, RequiredA | 'id'>[]) => {
			matchedLeftIds.clear();
			for (const row of leftRows) {
				matchedLeftIds.add(String(row.id));
			}
		};

		const hydrateJoin = (
			leftRows: PartialRow<Schema, RowName, RequiredA | 'id'>[],
			rightRows: PartialRow<OtherSchema, OtherRowName, RequiredB | 'id'>[],
			source: 'dexie' | 'supabase'
		) => {
			setMatchedLeftIds(leftRows);
			const hydratedLeft = this.Hydrate(
				leftRows,
				requiredAWithJoin as unknown as readonly RequiredA[]
			);
			const hydratedRight = pullB
				? other.Hydrate(rightRows, requiredBWithJoin as unknown as readonly RequiredB[])
				: ([] as SupaStructData<OtherSchema, OtherRowName, RequiredB | 'id'>[]);

			this.log(`Hydrated join (${source}) between ${this.table} and ${other.table}:`, {
				left: hydratedLeft.length,
				right: hydratedRight.length
			});

			return {
				left: hydratedLeft,
				right: hydratedRight
			};
		};

		const hydrateFromDexieFirst = async () => {
			this.log(`Hydrating join from Dexie between ${this.table} and ${other.table}`);
			const dexieA = this.getDexie(this.getSchemaDefinition().Row as any);
			const dexieB = other.getDexie(other.getSchemaDefinition().Row as any);

			if (!dexieA) {
				this.log(`No Dexie instance for ${this.table}, skipping Dexie hydration`);
				matchedLeftIds.clear();
				return {
					left: [] as SupaStructData<Schema, RowName, RequiredA | 'id'>[],
					right: [] as SupaStructData<OtherSchema, OtherRowName, RequiredB | 'id'>[]
				};
			}

			let rightRows: PartialRow<OtherSchema, OtherRowName, RequiredB | 'id'>[] = [];
			if (dexieB) {
				this.log(`Fetching right-side rows from Dexie for ${other.table} with whereB:`, whereB);
				const rightResult = await dexieB.get(whereB as any);
				if (rightResult.isOk()) {
					this.log(
						`Fetched ${rightResult.value.length} right-side rows from Dexie for ${other.table}`
					);
					rightRows = rightResult.value.map((r) => r.raw) as PartialRow<
						OtherSchema,
						OtherRowName,
						RequiredB | 'id'
					>[];
				}
			}

			if (pullB && rightRows.length) {
				this.log(`Hydrating right-side Dexie rows for ${other.table}`);
				other.Hydrate(rightRows, requiredBWithJoin as unknown as readonly RequiredB[]);
			}

			if (!rightRows.length) {
				matchedLeftIds.clear();
				return {
					left: [] as SupaStructData<Schema, RowName, RequiredA | 'id'>[],
					right: [] as SupaStructData<OtherSchema, OtherRowName, RequiredB | 'id'>[]
				};
			}

			const joinFields = resolveJoinFields();
			if (!joinFields) {
				this.log(
					`No join key mapping found for Dexie join between ${this.table} and ${other.table}; using Supabase fallback`
				);
				matchedLeftIds.clear();
				return {
					left: [] as SupaStructData<Schema, RowName, RequiredA | 'id'>[],
					right: [] as SupaStructData<OtherSchema, OtherRowName, RequiredB | 'id'>[]
				};
			}

			const leftAll = await dexieA.all();
			if (leftAll.isErr()) {
				this.log(`Error fetching left-side Dexie rows for ${this.table}:`, leftAll.error);
				matchedLeftIds.clear();
				return {
					left: [] as SupaStructData<Schema, RowName, RequiredA | 'id'>[],
					right: [] as SupaStructData<OtherSchema, OtherRowName, RequiredB | 'id'>[]
				};
			}

			const rightJoinValues = new SvelteSet(
				rightRows
					.map((row) => (row as any)?.[joinFields.right])
					.filter((value) => value !== undefined && value !== null)
					.map((value) => String(value))
			);

			const leftRows = leftAll.value
				.map((item) => item.raw as PartialRow<Schema, RowName, RequiredA | 'id'>)
				.filter((row) => {
					const value = (row as any)?.[joinFields.left];
					if (value === undefined || value === null) return false;
					return rightJoinValues.has(String(value));
				});

			return hydrateJoin(uniqueById(leftRows), uniqueById(rightRows), 'dexie');
		};

		const fetchJoinFromSupabase = async () => {
			this.log(
				`Fetching join from Supabase between ${this.table} and ${other.table} with whereB:`,
				whereB
			);
			let query = this.supabase
				.schema(this.schema)
				.from(this.table)
				.select(`${selectA}, ${String(other.table)}!inner(${selectB})`)
				.filter('archived', 'eq', false)
				.filter(`${String(other.table)}.archived`, 'eq', false);

			for (const [key, value] of Object.entries(whereB)) {
				query = query.filter(`${String(other.table)}.${key}`, 'eq', value as any);
			}

			const res = await query;
			if (res.error) {
				throw new SupaError('unknown', `Join query failed: ${res.error.message}`);
			}

			const leftRows: PartialRow<Schema, RowName, RequiredA | 'id'>[] = [];
			const rightRows: PartialRow<OtherSchema, OtherRowName, RequiredB | 'id'>[] = [];

			for (const item of (res.data ?? []) as any[]) {
				if (!item || typeof item !== 'object') continue;
				const { [String(other.table)]: nestedRight, ...leftOnly } = item;

				const rightCandidates = Array.isArray(nestedRight)
					? nestedRight
					: nestedRight
						? [nestedRight]
						: [];

				if (!rightCandidates.length) continue;

				leftRows.push(leftOnly as PartialRow<Schema, RowName, RequiredA | 'id'>);

				for (const candidate of rightCandidates) {
					if (!candidate || typeof candidate !== 'object') continue;
					if ((candidate as any).archived === true) continue;
					if ((leftOnly as any).archived === true) continue;
					rightRows.push(candidate as PartialRow<OtherSchema, OtherRowName, RequiredB | 'id'>);
				}
			}

			this.log(`Fetched join from Supabase between ${this.table} and ${other.table}:`, {
				left: leftRows.length,
				right: rightRows.length
			});

			return hydrateJoin(uniqueById(leftRows), uniqueById(rightRows), 'supabase');
		};

		const satisfies = (data: SupaStructData<Schema, RowName, RequiredA | 'id'>) => {
			return matchedLeftIds.has(String(data.id));
		};

		const allQuery = async (): Promise<SupaStructData<Schema, RowName, RequiredA | 'id'>[]> => {
			this.log(`Executing join query between ${this.table} and ${other.table}`);
			await hydrateFromDexieFirst();
			const joined = await fetchJoinFromSupabase();
			return joined.left;
		};

		const paginateQuery = async (page: number, size: number) => {
			const data = await allQuery();
			const from = (page - 1) * size;
			const to = from + size;
			return {
				data: data.slice(from, to),
				count: data.length
			};
		};

		return new SupaQuery<Schema, RowName, RequiredA | 'id'>(
			this,
			satisfies,
			allQuery,
			paginateQuery,
			requiredA,
			`join:${stable_stringify({
				left: { schema: this.schema, table: this.table },
				right: { schema: other.schema, table: other.table },
				whereB,
				pullB
			})}`,
			async () => {
				await hydrateFromDexieFirst();
			}
		);
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
	get<
		Required extends keyof RowWithoutArchived<Schema, RowName> = keyof RowWithoutArchived<
			Schema,
			RowName
		>
	>(
		queryData: Partial<RowWithoutArchived<Schema, RowName>>,
		config?: ReadConfig<Schema, RowName, Required>
	) {
		const required = this.getEffectiveRequiredFields(config?.only) as readonly (Required | 'id')[];
		const selectClause = this.buildSelectClause(config?.only);

		const satisfies = (data: SupaStructData<Schema, RowName, Required | 'id'>) =>
			Object.entries(queryData).every(
				([key, value]) => data.raw[key as keyof RowWithoutArchived<Schema, RowName>] === value
			);

		const hydrateLocal = async () => {
			const dexie = this.getDexie(this.getSchemaDefinition().Row as any);
			if (!dexie) return;
			const rows = await dexie.get(queryData as any);
			if (rows.isOk()) {
				this.Hydrate(
					rows.value.map((r) => r.raw),
					required as Required[]
				);
			}
		};

		const allQuery = async () => {
			this.log('Executing query with criteria:', queryData);
			let query = this.supabase.schema(this.config.schema).from(this.table).select(selectClause);

			for (const [key, value] of Object.entries(queryData)) {
				query = query.filter(key, 'eq', value);
			}

			query = query.filter('archived', 'eq', false);

			const res = await query;
			const result = this.runTransaction(
				{
					data: res.data as any,
					error: res.error
				},
				'array',
				required
			).unwrap();

			this.log('Fetched rows from Supabase for query:', queryData, result);

			return this.Hydrate(result, required as Required[], satisfies);
		};

		const paginateQuery = async (page: number, size: number) => {
			this.log(
				`Executing paginated query for page ${page} with size ${size} and criteria:`,
				queryData
			);
			const from = (page - 1) * size;
			const to = from + size - 1;
			let query = this.supabase
				.schema(this.config.schema)
				.from(this.table)
				.select(selectClause, { count: 'exact' })
				.range(from, to);

			for (const [key, value] of Object.entries(queryData)) {
				query = query.filter(key, 'eq', value);
			}

			query = query.filter('archived', 'eq', false);

			const res = await query;
			const result = this.runTransaction(
				{
					data: res.data as any,
					error: res.error
				},
				'array',
				required
			).unwrap();

			this.log(
				`Fetched rows from Supabase for paginated query (page ${page}, size ${size}):`,
				queryData,
				result
			);

			return {
				data: this.Hydrate(result, required as Required[]),
				count: res.count ?? 0
			};
		};

		const newQuery = new SupaQuery<Schema, RowName, Required | 'id'>(
			this,
			satisfies,
			allQuery,
			paginateQuery,
			required,
			`get:${stable_stringify({ query: queryData })}`,
			hydrateLocal
		);
		return newQuery;
	}

	/**
	 * Fetches rows that satisfy any provided field/value pair.
	 *
	 * @param {Partial<Row<Schema, RowName>>} queryData - OR-style match criteria.
	 * @returns {SupaQuery<Schema, RowName>} Query wrapper with reactive and paginated access.
	 * @example
	 * const q = struct.getOR({ archived: true, severity: 'warn' } as Partial<RowWithoutArchived<Schema, RowName>>);
	 */
	getOR<
		Required extends keyof RowWithoutArchived<Schema, RowName> = keyof RowWithoutArchived<
			Schema,
			RowName
		>
	>(
		queryData: Partial<RowWithoutArchived<Schema, RowName>>,
		config?: ReadConfig<Schema, RowName, Required>
	) {
		const required = this.getEffectiveRequiredFields(config?.only) as readonly (Required | 'id')[];
		const selectClause = this.buildSelectClause(config?.only);

		const satisfies = (data: SupaStructData<Schema, RowName, Required | 'id'>) =>
			entries.some(
				([key, value]) => data.raw[key as keyof RowWithoutArchived<Schema, RowName>] === value
			);

		const entries = Object.entries(queryData);
		const hydrateLocal = async () => {
			const dexie = this.getDexie(this.getSchemaDefinition().Row as any);
			if (!dexie) return;
			const rows = await dexie.getOR(queryData as any);
			if (rows.isOk()) {
				this.Hydrate(
					rows.value.map((r) => r.raw),
					required as Required[]
				);
			}
		};

		const allQuery = async () => {
			this.log('Executing getOR query with criteria:', queryData);
			if (!entries.length) {
				return [];
			}
			let query = this.supabase.schema(this.config.schema).from(this.table).select(selectClause);

			const orConditions = entries
				.map(([key, value]) => `${key}.eq.${this.toPostgrestLiteral(value)}`)
				.join(',');

			query = query.or(orConditions);

			query = query.filter('archived', 'eq', false);

			const res = await query;
			const result = this.runTransaction(
				{
					data: res.data as any,
					error: res.error
				},
				'array',
				required
			).unwrap();

			this.log('Fetched rows from Supabase for getOR query:', queryData, result);

			return this.Hydrate(result, required as Required[], satisfies);
		};

		const paginateQuery = async (page: number, size: number) => {
			this.log(
				`Executing paginated getOR query for page ${page} with size ${size} and criteria:`,
				queryData
			);
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
				.select(selectClause, { count: 'exact' })
				.range(from, to);

			const orConditions = entries
				.map(([key, value]) => `${key}.eq.${this.toPostgrestLiteral(value)}`)
				.join(',');

			query = query.or(orConditions);

			query = query.filter('archived', 'eq', false);

			const res = await query;
			const result = this.runTransaction(
				{
					data: res.data as any,
					error: res.error
				},
				'array',
				required
			).unwrap();

			this.log(
				`Fetched rows from Supabase for paginated getOR query (page ${page}, size ${size}):`,
				queryData,
				result
			);
			return {
				data: this.Hydrate(result, required as Required[]),
				count: res.count ?? 0
			};
		};

		const newQuery = new SupaQuery<Schema, RowName, Required | 'id'>(
			this,
			satisfies,
			allQuery,
			paginateQuery,
			required,
			`getOR:${stable_stringify({ query: queryData })}`,
			hydrateLocal
		);
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
	search<
		Required extends keyof RowWithoutArchived<Schema, RowName> = keyof RowWithoutArchived<
			Schema,
			RowName
		>
	>(query: SearchQuery<Schema, RowName>, config?: ReadConfig<Schema, RowName, Required>) {
		const required = this.getEffectiveRequiredFields(config?.only) as readonly (Required | 'id')[];
		const selectClause = this.buildSelectClause(config?.only);

		const satisfies = (data: SupaStructData<Schema, RowName, Required | 'id'>): boolean => {
			const evaluate = (q: SearchQuery<Schema, RowName>): boolean => {
				if ('field' in q) {
					const fieldValue = data.raw[q.field];
					if (fieldValue === undefined || fieldValue === null) {
						return false;
					}
					switch (q.operator) {
						case 'eq':
							return (fieldValue as any) === (q.value as any);
						case 'neq':
							return (fieldValue as any) !== (q.value as any);
						case 'gt':
							return ((fieldValue as any) > q.value) as any;
						case 'gte':
							return ((fieldValue as any) >= q.value) as any;
						case 'lt':
							return ((fieldValue as any) < q.value) as any;
						case 'lte':
							return ((fieldValue as any) <= q.value) as any;
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

		const main = this.supabase
			.schema(this.schema)
			.from(this.table)
			.select(selectClause, { count: 'exact' })
			.filter('archived', 'eq', false);

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
							return `${String(condition.field)}.${condition.operator}.${this.toPostgrestLiteral(value)}`;
						} else {
							throw new Error('Nested OR conditions are not supported');
						}
					})
					.join(',');
				return base.or(orConditions);
			}

			return base;
		};
		const hydrateLocal = async () => {
			const dexie = this.getDexie(this.getSchemaDefinition().Row as any);
			if (!dexie) return;
			const rows = await dexie.search(query as any);
			if (rows.isOk()) {
				this.Hydrate(
					rows.value.map((r) => r.raw),
					required as Required[]
				);
			}
		};
		const allQuery = async (): Promise<SupaStructData<Schema, RowName, Required | 'id'>[]> => {
			this.log('Executing search query on table', this.table, 'with criteria', query);
			const queryBuilder = buildQuery(main, query);

			const res = await queryBuilder;
			const result = this.runTransaction(
				{
					data: res.data as any,
					error: res.error
				},
				'array',
				required
			).unwrap();

			this.log('Fetched search results from Supabase for table', this.table, result);

			return this.Hydrate(result, required as Required[], satisfies);
		};

		const paginateQuery = async (
			page: number,
			size: number
		): Promise<{
			data: SupaStructData<Schema, RowName, Required | 'id'>[];
			count: number;
		}> => {
			this.log('Executing paginated search query on table', this.table, 'with criteria', query, {
				page,
				size
			});
			const from = (page - 1) * size;
			const to = from + size - 1;

			const queryBuilder = buildQuery(
				this.supabase.schema(this.schema).from(this.table).select(selectClause, { count: 'exact' }),
				query
			)
				.range(from, to)
				.filter('archived', 'eq', false);

			const res = await queryBuilder;
			const result = this.runTransaction(
				{
					data: res.data as any,
					error: res.error
				},
				'array',
				required
			).unwrap();

			this.log('Fetched paginated search results from Supabase for table', this.table, result);

			return {
				data: this.Hydrate(result, required as Required[]),
				count: res.count ?? 0
			};
		};

		const newQuery = new SupaQuery<Schema, RowName, Required | 'id'>(
			this,
			satisfies,
			allQuery,
			paginateQuery,
			required,
			`search:${stable_stringify({ query })}`,
			hydrateLocal
		);
		// this.queryCache.set(
		// 	satisfies as (data: SupaStructData<Schema, RowName, 'id'>) => boolean,
		// 	newQuery as unknown as SupaQuery<Schema, RowName, keyof RowWithoutArchived<Schema, RowName>>
		// );
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
	fromId<
		Required extends keyof RowWithoutArchived<Schema, RowName> = keyof RowWithoutArchived<
			Schema,
			RowName
		>
	>(id: string, config?: ReadConfig<Schema, RowName, Required>) {
		const required = this.getEffectiveRequiredFields(config?.only) as readonly (Required | 'id')[];
		const selectClause = this.buildSelectClause(config?.only);

		return attemptAsync<SupaStructData<Schema, RowName, Required | 'id'>>(async () => {
			const dexie = this.getDexie(this.getSchemaDefinition().Row as any);
			if (dexie) {
				const res = await dexie.fromId(id).unwrap();
				if (res) {
					return this.Generator(res.raw, { required });
				}
			}

			this.log(`Fetching row with id ${id} from table ${this.table}`);
			const res = await this.supabase
				.schema(this.config.schema)
				.from(this.table)
				.select(selectClause)
				.filter('id', 'eq', id)
				.filter('archived', 'eq', false)
				.single();
			const result = this.runTransaction(
				{
					data: res.data as any,
					error: res.error
				},
				'single',
				required
			).unwrap();

			this.log(`Fetched row with id ${id} from Supabase for table ${this.table}`, result);

			if (dexie && result) {
				dexie.upsert(result as any).then((res) => {
					if (res.isOk()) {
						this.log(`Upserted row with id ${id} into IndexedDB for table ${this.table}`);
					} else {
						this.log(`Error upserting row with id ${id} into IndexedDB:`, res.error);
					}
				});
			}

			return this.Generator(result, { required });
		});
	}

	fromIds<
		Required extends keyof RowWithoutArchived<Schema, RowName> = keyof RowWithoutArchived<
			Schema,
			RowName
		>
	>(ids: string[], config?: ReadConfig<Schema, RowName, Required>) {
		const required = this.getEffectiveRequiredFields(config?.only) as readonly (Required | 'id')[];
		const selectClause = this.buildSelectClause(config?.only);

		const satisfies = (data: SupaStructData<Schema, RowName, Required | 'id'>) =>
			ids.includes(String(data.id));
		const hydrateLocal = async () => {
			const dexie = this.getDexie(this.getSchemaDefinition().Row as any);
			if (!dexie) return;
			const rows = await dexie.fromIds(ids);
			if (rows.isOk()) {
				this.Hydrate(
					rows.value.map((r) => r.raw),
					required as Required[]
				);
			}
		};

		const allQuery = async (): Promise<SupaStructData<Schema, RowName, Required | 'id'>[]> => {
			this.log(`Fetching rows with ids ${ids.join(', ')} from table ${this.table}`);
			const res = await this.supabase
				.schema(this.config.schema)
				.from(this.table)
				.select(selectClause)
				.filter('id', 'in', `(${ids.join(',')})`)
				.filter('archived', 'eq', false);
			const result = this.runTransaction(
				{
					data: res.data as any,
					error: res.error
				},
				'array',
				required
			).unwrap();

			this.log(
				`Fetched ${result.length} rows from Supabase with ids ${ids.join(', ')} from table ${this.table}`,
				result
			);

			return this.Hydrate(result, required as Required[], satisfies);
		};

		const paginateQuery = async (
			page: number,
			size: number
		): Promise<{
			data: SupaStructData<Schema, RowName, Required | 'id'>[];
			count: number;
		}> => {
			this.log(
				`Fetching page ${page} with size ${size} for rows with ids ${ids.join(', ')} from table ${this.table}`
			);
			const from = (page - 1) * size;
			const to = from + size - 1;
			const res = await this.supabase
				.schema(this.config.schema)
				.from(this.table)
				.select(selectClause, { count: 'exact' })
				.filter('id', 'in', `(${ids.join(',')})`)
				.filter('archived', 'eq', false)
				.range(from, to);
			const result = this.runTransaction(
				{
					data: res.data as any,
					error: res.error
				},
				'array',
				required
			).unwrap();

			this.log(
				`Fetched ${result.length} rows from Supabase with ids ${ids.join(', ')} for page ${page} with size ${size} from table ${this.table}`,
				result
			);

			return {
				data: this.Hydrate(result, required as Required[]),
				count: res.count ?? 0
			};
		};

		const newQuery = new SupaQuery<Schema, RowName, Required | 'id'>(
			this,
			satisfies,
			allQuery,
			paginateQuery,
			required,
			`fromIds:${stable_stringify({ ids })}`,
			hydrateLocal
		);
		return newQuery;
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
		return attemptAsync<
			SupaStructData<Schema, RowName, 'id' | keyof RowWithoutArchived<Schema, RowName>>[],
			SupaError
		>(async () => {
			// hydrate immediately for reactivity
			const hydrated = this.Hydrate(
				data.map(
					(d) =>
						({
							created_at: new SvelteDate().toISOString(),
							id: crypto.randomUUID(),
							...d
						}) as any
				)
			);
			const dexie = this.getDexie(this.getSchemaDefinition().Row as any);
			if (dexie) {
				// insert into dexie asyncronously and don't wait for it
				dexie.bulkNew(hydrated.map((d) => d.raw as any)).then((results) => {
					if (results.isErr()) {
						this.log('Error inserting new row into Dexie cache:', results.error);
					}
				});
			}

			if (!is_online()) {
				this.log('Offline: Skipping Supabase insert and only updating local cache');
				await OfflineUpdates.new({
					table: this.table,
					schema: this.config.schema,
					data: hydrated.map((d) => d.raw as any),
					action: 'insert',
					id: `${Math.floor(Math.random() * 1000000)}-${Date.now()}`,
					created_at: new SvelteDate()
				});
				return hydrated;
			}

			const { error } = await this.supabase
				.schema(this.config.schema)
				.from(this.table)
				.insert(hydrated.map((d) => d.raw as any));

			if (error) {
				this.log('Error inserting new row:', error);
				for (const item of hydrated) item['_deleteLocal']();
				throw new Error(`Failed to insert new row: ${error.message}`);
			}
			return hydrated;
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
	upsert(
		data: (InsertWithoutArchived<Schema, Extract<RowName, InsertTableNames<Schema>>> & {
			id?: string;
			created_at?: Date;
		})[],
		config?: {
			onConflict: keyof RowWithoutArchived<Schema, RowName>;
			ignoreDuplicates?: boolean;
		}
	) {
		return attemptAsync(async () => {
			const hydrated = this.Hydrate(
				data.map(
					(d) =>
						({
							created_at: new SvelteDate().toISOString(),
							id: d.id ?? crypto.randomUUID(),
							...d
						}) as any
				)
			);

			const dexie = this.getDexie(this.getSchemaDefinition().Row as any);
			if (dexie) {
				// upsert into dexie asyncronously and don't wait for it
				dexie.bulkUpsert(hydrated.map((d) => d.raw as any)).then((results) => {
					if (results.isErr()) {
						this.log('Error upserting row into Dexie cache:', results.error);
					}
				});
			}

			if (!is_online()) {
				this.log('Offline: Skipping Supabase upsert and only updating local cache');
				await OfflineUpdates.new({
					table: this.table,
					schema: this.config.schema,
					data: hydrated.map((d) => d.raw as any),
					action: 'upsert',
					id: `${Math.floor(Math.random() * 1000000)}-${Date.now()}`,
					created_at: new SvelteDate()
				});
				return hydrated;
			}

			const { error } = await this.supabase
				.schema(this.config.schema)
				.from(this.table)
				.upsert(
					data as any,
					config
						? {
								onConflict: String(config.onConflict),
								ignoreDuplicates: config.ignoreDuplicates ?? true
							}
						: undefined
				);

			if (error) {
				this.log('Error upserting row:', error);
				for (const item of hydrated) item['_deleteLocal']();
				throw new Error(`Failed to upsert row: ${error.message}`);
			}

			return hydrated;
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
	all<
		Required extends keyof RowWithoutArchived<Schema, RowName> = keyof RowWithoutArchived<
			Schema,
			RowName
		>
	>(config?: ReadConfig<Schema, RowName, Required>) {
		const required = this.getEffectiveRequiredFields(config?.only) as readonly (Required | 'id')[];
		const selectClause = this.buildSelectClause(config?.only);

		const satisfies = (_: SupaStructData<Schema, RowName, Required | 'id'>) => true;
		const hydrateLocal = async () => {
			const dexie = this.getDexie(this.getSchemaDefinition().Row as any);
			if (!dexie) return;
			const rows = await dexie.all();
			this.log(`Fetched all rows from IndexedDB for table ${this.table}`, rows);
			if (rows.isOk()) {
				this.Hydrate(
					rows.value.map((r) => r.raw),
					required as Required[]
				);
			}
		};

		const allQuery = async () => {
			this.log(
				`Fetching all rows for table ${this.table} with required fields: ${required.join(', ')}`
			);
			const res = await this.supabase
				.schema(this.config.schema)
				.from(this.table)
				.select(selectClause)
				.filter('archived', 'eq', false);
			const result = this.runTransaction(
				{
					data: res.data as any,
					error: res.error
				},
				'array',
				required
			).unwrap();

			this.log(`Fetched ${result.length} rows from Supabase for table ${this.table}`, result);

			return this.Hydrate(result, required as Required[], satisfies);
		};

		const paginateQuery = async (page: number, size: number) => {
			this.log(
				`Fetching page ${page} (size ${size}) for table ${this.table} with required fields: ${required.join(', ')}`
			);
			const from = (page - 1) * size;
			const to = from + size - 1;
			const res = await this.supabase
				.schema(this.config.schema)
				.from(this.table)
				.select(selectClause, { count: 'exact' })
				.range(from, to)
				.filter('archived', 'eq', false);
			const result = this.runTransaction(
				{
					data: res.data as any,
					error: res.error
				},
				'array',
				required
			).unwrap();

			return {
				data: this.Hydrate(result, required as Required[]),
				count: res.count ?? 0
			};
		};

		const newQuery = new SupaQuery<Schema, RowName, Required | 'id'>(
			this,
			satisfies,
			allQuery,
			paginateQuery,
			required,
			'all',
			hydrateLocal
		);
		return newQuery;
	}

	Arr(satisfies: (data: SupaStructData<Schema, RowName>) => boolean) {
		const allQuery = async () => {
			throw new Error(
				'Custom Struct Arrays are purely reactive and do not support direct fetching'
			);
		};

		const paginateQuery = async (_page: number, _size: number) => {
			throw new Error(
				'Custom Struct Arrays are purely reactive and do not support paginated fetching'
			);
		};

		const newQuery = new SupaQuery(this, satisfies, allQuery, paginateQuery);
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
			field: keyof RowWithoutArchived<Schema, Name>;
			operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike';
			value: RowWithoutArchived<Schema, Name>[keyof RowWithoutArchived<Schema, Name>];
	  }
	| {
			type: 'and' | 'or';
			conditions: SearchQuery<Schema, Name>[];
	  };

// Define a type for the paginated response that includes the total count
type PaginatedResponse<T> = { data: T[]; count: number };

// eslint-disable-next-line svelte/prefer-svelte-reactivity
const in_flight_queries = new Map<string, Promise<unknown>>();

class SupaQuery<
	Schema extends RowSchemaName,
	RowName extends RowTableNames<Schema>,
	Required extends keyof RowWithoutArchived<Schema, RowName> = keyof RowWithoutArchived<
		Schema,
		RowName
	>,
	Default extends boolean = false
> {
	private _syncInFlight: Promise<{
		source: 'cache' | 'supabase';
		refreshing: boolean;
		promise: Promise<Result<SupaStructData<Schema, RowName, Required>[], SupaError>>;
	}> | null = null;
	private _lastSyncSource: 'cache' | 'supabase' | null = null;

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
		private readonly satisfies: (data: SupaStructData<Schema, RowName, Required>) => boolean,
		private readonly fetchAll: () => Promise<SupaStructData<Schema, RowName, Required>[]>,
		private readonly paginateQuery: (
			page: number,
			size: number
		) => Promise<PaginatedResponse<SupaStructData<Schema, RowName, Required>>>,
		private readonly required: readonly (Required | 'id')[] = ['id'] as const,
		private readonly key?: string,
		private readonly hydrateLocal?: () => Promise<void>,
		default_data: SupaStructData<Schema, RowName, Required> | null = null
	) {
		this._default = default_data;
	}

	log(...args: any[]) {
		if (this.struct.config.debug) {
			this.struct.log('[SupaQuery]', this.key ? `(${this.key})` : '(unknown)', ...args);
		}
	}

	private trace(...args: any[]) {
		if (!browser) return;
		if (!this.struct.config.debug) return;
		console.log('[SupaQueryTrace]', ...args);
	}

	/**
	 * Returns a live filtered view of cached rows.
	 *
	 * @returns {SupaStructData<Schema, RowName, Required>[]} Cached rows matching the query predicate.
	 * @example
	 * const rows = query.reactive;
	 */
	get reactive() {
		return Array.from(this.struct.cache.values())
			.filter(this.satisfies as (data: SupaStructData<Schema, RowName, 'id'>) => boolean)
			.sort((this._sort as any) ?? undefined) as SupaStructData<Schema, RowName, Required>[];
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
			this._paginatedInstance = new SupaPagination(this.struct, this.paginateQuery) as any;
		}
		return this._paginatedInstance as SupaPagination<Schema, RowName>;
	}

	private check_cache(requestedTtl: number): Promise<boolean> {
		return new Promise<boolean>((resolve) => {
			return resolve(false); // disable cache for now
			if (!browser) {
				this.trace('check_cache -> false (not browser)', {
					key: this.key,
					unique: this.unique_key
				});
				return resolve(false);
			}
			if (!this.key) {
				this.trace('check_cache -> false (missing key)', { unique: this.unique_key });
				return resolve(false);
			}
			this.log('Checking query cache for key:', this.key);
			this.trace('check_cache start', {
				key: this.key,
				unique: this.unique_key,
				required: this.required.map(String)
			});
			QueryCache.get({
				query: this.key,
				schema: this.struct.config.schema,
				table: this.struct.table
			})
				.first()
				.then(async (cached) => {
					if (!this.key) {
						this.trace('check_cache -> false (key disappeared)');
						return resolve(false);
					}
					if (cached.isErr()) {
						this.log('Error checking query cache:', cached.error);
						this.trace('check_cache -> false (query cache read error)', {
							error: String(cached.error)
						});
						return resolve(false);
					}
					if (!cached.value) {
						this.log('No query cache found for key:', this.key);
						this.trace('check_cache -> false (no query cache row)', {
							key: this.key,
							unique: this.unique_key
						});
						return resolve(false);
					}

					if (cached.value.raw.version !== QUERY_CACHE_VERSION) {
						this.log('Query cache version mismatch, deleting stale row for key:', this.key);
						const deleted = await cached.value.delete();
						if (deleted.isErr()) {
							this.trace('check_cache stale version delete failed', {
								key: this.key,
								error: String(deleted.error)
							});
						} else {
							this.trace('check_cache stale version deleted', {
								key: this.key,
								cachedVersion: cached.value.raw.version,
								expectedVersion: QUERY_CACHE_VERSION
							});
						}
						return resolve(false);
					}

					// check if the query is past expiration
					const now = Date.now();
					if (now - cached.value.raw.last_sync > requestedTtl) {
						this.log('Query cache expired for key:', this.key);
						this.trace('check_cache -> false (expired)', {
							key: this.key,
							now,
							last_sync: cached.value.raw.last_sync,
							requestedTtl,
							age: now - cached.value.raw.last_sync
						});
						return resolve(false);
					} else {
						const cached_required = new Set(cached.value.raw.required.split(','));
						// check if the required fields have changed

						// all required fields must be present in the cached query for it to be valid

						const cacheSatisfies = this.required.every((field) =>
							cached_required.has(String(field))
						);

						if (!cacheSatisfies) {
							this.log('Query cache required fields missing:', this.key);
							this.trace('check_cache -> false (required mismatch)', {
								key: this.key,
								cached_required: Array.from(cached_required),
								required: this.required.map(String)
							});
							return resolve(false);
						}
						// cache is valid
						this.log('Query cache valid for key:', this.key);
						this.trace('check_cache -> true (valid)', {
							key: this.key,
							now,
							last_sync: cached.value.raw.last_sync,
							requestedTtl,
							age: now - cached.value.raw.last_sync
						});
						return resolve(true);
					}
				})
				.catch((error) => {
					this.trace('check_cache -> false (unexpected throw)', {
						error: String(error)
					});
					resolve(false);
				});
		});
	}

	private hydrate_local() {
		if (!this.hydrateLocal) {
			this.trace('hydrate_local -> skipped (no hydrateLocal function)', {
				key: this.key,
				unique: this.unique_key
			});
			return Promise.resolve();
		}
		this.trace('hydrate_local -> start', {
			key: this.key,
			unique: this.unique_key
		});
		return this.hydrateLocal().then(() => {
			this.trace('hydrate_local -> complete', {
				key: this.key,
				unique: this.unique_key
			});
		});
	}

	private cache_has_required_fields() {
		const rows = this.reactive;
		if (!rows.length) {
			this.trace('cache required check -> false (no matching rows in cache)', {
				key: this.key,
				unique: this.unique_key
			});
			return false;
		}

		for (const row of rows) {
			for (const field of this.required) {
				if (!(String(field) in row.raw)) {
					this.trace('cache required check -> false (missing field on row)', {
						key: this.key,
						unique: this.unique_key,
						rowId: row.id,
						missingField: String(field)
					});
					return false;
				}
			}
		}

		this.trace('cache required check -> true (all required fields present)', {
			key: this.key,
			unique: this.unique_key,
			rows: rows.length,
			required: this.required.map(String)
		});
		return true;
	}

	private resolve_from_cache(
		onfulfilled?:
			| ((
					value: Result<SupaStructData<Schema, RowName, Required>[], SupaError>
			  ) => void | PromiseLike<void>)
			| null
	) {
		return this.hydrate_local().then(() => {
			const result = new Ok(this.reactive.sort((this._sort as any) ?? undefined)) as Result<
				SupaStructData<Schema, RowName, Required>[],
				SupaError
			>;
			onfulfilled?.(result);
			return result;
		});
	}

	private resolve_cache_snapshot(
		onfulfilled?:
			| ((
					value: Result<SupaStructData<Schema, RowName, Required>[], SupaError>
			  ) => void | PromiseLike<void>)
			| null
	) {
		const result = new Ok(this.reactive.sort((this._sort as any) ?? undefined)) as Result<
			SupaStructData<Schema, RowName, Required>[],
			SupaError
		>;
		onfulfilled?.(result);
		return Promise.resolve(result);
	}

	private run_fetch(
		onfulfilled?:
			| ((
					value: Result<SupaStructData<Schema, RowName, Required>[], SupaError>
			  ) => void | PromiseLike<void>)
			| null
	) {
		this._loading = true;
		const p = this.hydrate_local()
			.then(() => this.fetchAll())
			.then((res) => {
				this.log('Query completed successfully for key:', this.key, 'with', res.length, 'results');
				this._loading = false;
				const result = new Ok(res.sort(this._sort ?? undefined));
				onfulfilled?.(result);
				return result;
			})
			.catch((err) => {
				this._loading = false;
				let message = 'An unknown error occurred';
				let code: SupaErrorCode = 'unknown';
				if (typeof err === 'object' && err && 'message' in err && typeof err.message === 'string') {
					switch (true) {
						case err.message.includes('network'):
							message = 'Network error: Please check your internet connection.';
							code = 'network';
							break;
						case err.message.includes('timeout'):
							message = 'Request timed out: The server took too long to respond.';
							code = 'timeout';
							break;
						case err.message.includes('permission'):
							message = 'Permission denied: You do not have access to this resource.';
							code = 'unauthorized';
							break;
						default:
							message = `Error: ${err.message}`;
							code = 'unknown';
							break;
					}
				}
				const result = new Err(new SupaError(code, message)) as Result<
					SupaStructData<Schema, RowName, Required>[],
					SupaError
				>;
				onfulfilled?.(result);
				return result;
			})
			.finally(() => {
				this._loading = false;
			});

		this.promise = p;
		return p;
	}

	private persist_query_cache_after_fetch(
		ttl: number,
		res: Result<SupaStructData<Schema, RowName, Required>[], SupaError>
	) {
		return (async () => {
			if (res.isErr()) {
				this.log('Error syncing query cache:', res.error);
				this.trace('sync cache write skipped due fetch error', {
					key: this.key,
					error: String(res.error)
				});
				return;
			}

			if (!this.key) return;

			const now = Date.now();
			const cacheRowId = `${this.struct.config.schema}:${this.struct.table}:${this.key}`;
			const has = await QueryCache.get({
				query: this.key,
				schema: this.struct.config.schema,
				table: this.struct.table
			}).first();

			if (has.isErr()) {
				this.log('Error syncing query cache:', has.error);
				this.trace('sync cache write -> read existing failed', {
					key: this.key,
					error: String(has.error)
				});
				return;
			}

			if (has.value) {
				const required = new SvelteSet(has.value.raw.required.split(',') ?? []);

				for (const field of this.required) {
					required.add(String(field));
				}

				const updatePayload: {
					last_sync: number;
					required: string;
					ttl?: number;
					version?: number;
				} = {
					last_sync: now,
					required: Array.from(required).join(',')
				};

				if (has.value.raw.version !== QUERY_CACHE_VERSION) {
					updatePayload.version = QUERY_CACHE_VERSION;
				}

				const updated = await has.value.update(updatePayload);
				if (updated.isErr()) {
					this.log('Error updating query cache row:', updated.error);
					this.trace('sync cache write -> update failed', {
						key: this.key,
						error: String(updated.error)
					});
				} else {
					this.trace('sync cache write -> updated existing row', {
						key: this.key,
						now,
						requestedTtl: ttl
					});
				}
				return;
			}

			const created = await QueryCache.upsert({
				query: this.key,
				schema: this.struct.config.schema,
				table: this.struct.table,
				version: QUERY_CACHE_VERSION,
				required: this.required.map(String).join(','),
				last_sync: now,
				created_at: new SvelteDate(),
				id: cacheRowId
			});
			if (created.isErr()) {
				this.log('Error creating query cache row:', created.error);
				this.trace('sync cache write -> create failed', {
					key: this.key,
					error: String(created.error)
				});
			} else {
				this.trace('sync cache write -> created row', {
					key: this.key,
					now,
					ttl,
					cacheRowId
				});
			}
		})();
	}

	private _ttl: number = 0;

	sync(ttl: number) {
		this._ttl = ttl;
		this.trace('sync start', { key: this.key, unique: this.unique_key, ttl });
		const syncPromise = this.hydrate_local()
			.then(() => this.check_cache(ttl))
			.then((cacheIsValidByMeta) => {
				const cacheHasRequiredFields = cacheIsValidByMeta && this.cache_has_required_fields();
				const is_valid = cacheIsValidByMeta && cacheHasRequiredFields;
				if (!is_valid) {
					this._lastSyncSource = 'supabase';
					this.trace('sync decision -> supabase', {
						key: this.key,
						unique: this.unique_key,
						cacheIsValidByMeta,
						cacheHasRequiredFields
					});
					let p = this.promise;
					if (p) {
						this.trace('sync reusing existing in-flight fetch', {
							key: this.key,
							unique: this.unique_key
						});
						return {
							source: 'supabase' as const,
							refreshing: this._loading,
							promise: p
						};
					}
					p = this.run_fetch();
					p.then((res) => this.persist_query_cache_after_fetch(ttl, res));
					return {
						source: 'supabase' as const,
						refreshing: true,
						promise: p
					};
				}

				this._lastSyncSource = 'cache';
				this.log('Using hydrated local cache for key:', this.key);
				this.trace('sync decision -> cache', {
					key: this.key,
					unique: this.unique_key,
					cacheIsValidByMeta,
					cacheHasRequiredFields
				});
				return {
					source: 'cache' as const,
					refreshing: false,
					promise: this.resolve_cache_snapshot()
				};
			});

		this._syncInFlight = syncPromise.finally(() => {
			this.trace('sync complete', {
				key: this.key,
				unique: this.unique_key,
				lastSyncSource: this._lastSyncSource
			});
			if (this._syncInFlight === syncPromise) {
				this._syncInFlight = null;
			}
		});

		return this._syncInFlight;
	}

	/**
	 * Enables promise-like usage (`await query`) to execute a full fetch.
	 *
	 * @param {(value: Result<SupaStructData<Schema, RowName, Required>[], SupaError>) => void | PromiseLike<void> | null} [onfulfilled] - Fulfillment handler.
	 * @returns {Promise<Result<SupaStructData<Schema, RowName, Required>[], SupaError>>} Query execution result.
	 * @example
	 * const result = await query;
	 */
	then(
		onfulfilled?:
			| ((
					value: Result<SupaStructData<Schema, RowName, Required>[], SupaError>
			  ) => void | PromiseLike<void>)
			| null
	) {
		this.trace('then invoked', {
			key: this.key,
			unique: this.unique_key,
			hasSyncInFlight: !!this._syncInFlight,
			lastSyncSource: this._lastSyncSource,
			hasInflightFetch: !!this.promise
		});
		const existing = this.promise;
		if (existing) {
			this.log('Query already in flight, returning existing promise for key:', this.key);
			this.trace('then -> existing in-flight fetch', {
				key: this.key,
				unique: this.unique_key
			});
			return existing.then((res) => {
				onfulfilled?.(res);
				return res;
			});
		}

		if (this._syncInFlight) {
			return this._syncInFlight.then((syncState) => {
				this.trace('then observed sync completion', {
					key: this.key,
					unique: this.unique_key,
					source: syncState.source,
					refreshing: syncState.refreshing
				});
				if (syncState.source === 'cache') {
					this.log('Skipping Supabase fetch after cache-valid sync for key:', this.key);
					this.trace('then -> cache path after sync', {
						key: this.key,
						unique: this.unique_key
					});
					return this.resolve_from_cache(onfulfilled);
				}

				return syncState.promise.then((res) => {
					onfulfilled?.(res);
					return res;
				});
			});
		}

		if (this._lastSyncSource === 'cache') {
			this.log('Serving query from local cache based on prior valid sync for key:', this.key);
			this.trace('then -> cache path from prior sync', {
				key: this.key,
				unique: this.unique_key
			});
			return this.resolve_from_cache(onfulfilled);
		}

		if (browser && this.key) {
			this.trace('then -> validating cache before fetch (no sync marker)', {
				key: this.key,
				unique: this.unique_key
			});
			return this.hydrate_local()
				.then(() => this.check_cache(this._ttl))
				.then((cacheIsValidByMeta) => {
					const cacheHasRequiredFields = cacheIsValidByMeta && this.cache_has_required_fields();
					const isValid = cacheIsValidByMeta && cacheHasRequiredFields;
					if (isValid) {
						this._lastSyncSource = 'cache';
						this.trace('then -> cache path after direct validation', {
							key: this.key,
							unique: this.unique_key,
							cacheIsValidByMeta,
							cacheHasRequiredFields
						});
						return this.resolve_cache_snapshot(onfulfilled);
					}
					this.trace('then -> supabase fetch after direct cache validation miss', {
						key: this.key,
						unique: this.unique_key,
						cacheIsValidByMeta,
						cacheHasRequiredFields
					});
					return this.run_fetch(onfulfilled);
				});
		}

		this.trace('then -> supabase fetch path (no valid sync marker)', {
			key: this.key,
			unique: this.unique_key
		});
		return this.run_fetch(onfulfilled);
	}

	get loading() {
		return this._loading;
	}

	get unique_key() {
		return `${this.struct.config.schema}:${this.struct.table}:${this.key ?? 'unknown'}`;
	}

	private get promise() {
		const p = in_flight_queries.get(this.unique_key);
		if (p) {
			return p as Promise<Result<SupaStructData<Schema, RowName, Required>[], SupaError>>;
		}
		return undefined;
	}

	private set promise(
		p: Promise<Result<SupaStructData<Schema, RowName, Required>[], SupaError>> | undefined
	) {
		const key = this.key;
		if (key) {
			if (p) {
				in_flight_queries.set(this.unique_key, p);
				p.finally(() => {
					if (in_flight_queries.get(this.unique_key) === p) {
						in_flight_queries.delete(this.unique_key);
					}
				});
			} else {
				in_flight_queries.delete(this.unique_key);
			}
		}
	}

	unwrap() {
		return this.then().then((res) => res.unwrap());
	}

	unwrapOr(defaultValue: SupaStructData<Schema, RowName, Required>[]) {
		return this.then().then((res) => res.unwrapOr(defaultValue));
	}

	private _sort:
		| ((
				a: SupaStructData<Schema, RowName, Required>,
				b: SupaStructData<Schema, RowName, Required>
		  ) => number)
		| null = $state(null);

	sort(
		compareFn: (
			a: SupaStructData<Schema, RowName, Required>,
			b: SupaStructData<Schema, RowName, Required>
		) => number
	) {
		this._sort = compareFn;
		return this;
	}

	stream(config?: { pageSize?: number; concurrent?: number }) {
		return new SupaStream(this.paginateQuery, {
			pageSize: config?.pageSize ?? 50,
			concurrent: config?.concurrent ?? 3
		});
	}

	listen(
		listener: (data: SupaStructData<Schema, RowName, Required>) => void,
		config?: {
			cache?: boolean;
			fetch?: boolean;
			new?: boolean;
		}
	) {
		const done = new SvelteSet<string>();
		// iterate through all current
		if (config?.cache !== false) {
			// default to true if not specified
			for (const item of this.reactive) {
				if (!done.has(String(item.raw.id))) {
					done.add(String(item.raw.id));
					listener(item);
				}
			}
		}

		if (config?.fetch !== false) {
			// default to true if not specified
			this.then().then((result) => {
				if (result.isOk()) {
					for (const item of result.value) {
						if (!done.has(String(item.id))) {
							done.add(String(item.id));
							listener(item);
						}
					}
				}
			});
		}

		if (config?.new !== false) {
			const wrapper = (data: SupaStructData<Schema, RowName, Required>) => {
				if (this.satisfies(data) && !done.has(String(data.raw.id))) {
					done.add(String(data.raw.id));
					listener(data);
				}
			};

			return this.struct.on('new', wrapper);
		}
		return () => {};
	}

	first() {
		return attemptAsync(async () => {
			const res = await this.then();
			return res.unwrap()[0] ?? null;
		});
	}

	last() {
		return attemptAsync(async () => {
			const res = await this.then();
			const data = res.unwrap();
			return data[data.length - 1] ?? null;
		});
	}

	_default: SupaStructData<Schema, RowName, Required> | null = $state(null);

	default(
		value: InsertWithoutArchived<Schema, Extract<RowName, InsertTableNames<Schema>>>
	): SupaQuery<Schema, RowName, Required | 'id', true> {
		const data = new SupaStructData<Schema, RowName, Required>(
			this.struct,
			{
				id: '',
				created_at: new SvelteDate().toISOString(),
				archived: false,
				...value
			} as any,
			{
				is_temporary: true
			}
		);
		return new SupaQuery<Schema, RowName, Required | 'id', true>(
			this.struct,
			this.satisfies,
			this.fetchAll as any,
			this.paginateQuery as any,
			this.required,
			this.key,
			this.hydrateLocal,
			data as any
		);
	}

	get single(): Default extends false
		? SupaStructData<Schema, RowName, Required> | null
		: SupaStructData<Schema, RowName, Required> {
		const [first, last] = [this.reactive[0], this._default];
		if (!last) return null as any;
		return first ?? last;
	}
}

class SupaStream<
	Schema extends RowSchemaName,
	RowName extends RowTableNames<Schema>,
	Required extends keyof RowWithoutArchived<Schema, RowName> = keyof RowWithoutArchived<
		Schema,
		RowName
	>
> extends Stream<SupaStructData<Schema, RowName, Required>> {
	constructor(
		private paginateQuery: (
			page: number,
			size: number
		) => Promise<PaginatedResponse<SupaStructData<Schema, RowName, Required>>>,
		private config: {
			/**
			 * Number of items to fetch per page. Adjust based on expected row size and network conditions.
			 */
			pageSize: number;
			/**
			 * Maximum number of concurrent page fetches. Higher values may speed up retrieval but increase load on the database and network.
			 */
			concurrent: number;
		}
	) {
		super();
	}

	private running = false;
	private currentPage = 1;
	private activeFetches = 0;
	private hasMore = true;

	start() {
		if (this.running) return;
		this.running = true;
		const { pageSize, concurrent } = this.config;

		const fetchNext = async () => {
			if (this.activeFetches >= concurrent || !this.hasMore || !this.running) return;
			this.activeFetches++;
			try {
				const { data, count } = await this.paginateQuery(this.currentPage, pageSize);
				for (const item of data) {
					this.add(item); // emits each item to stream listeners
				}
				this.hasMore = this.currentPage * pageSize < count;

				if (!this.hasMore) {
					this.end();
				}

				this.currentPage++;
				fetchNext(); // Trigger next fetch if possible
			} catch (err) {
				this.error(err instanceof Error ? err : new Error(String(err)));
			} finally {
				this.activeFetches--;
			}
		};

		// Start initial fetches up to the concurrency limit
		for (let i = 0; i < concurrent; i++) {
			fetchNext();
		}
	}

	pause() {
		this.running = false;
	}
}

class SupaPagination<
	Schema extends RowSchemaName,
	RowName extends RowTableNames<Schema>,
	Required extends keyof RowWithoutArchived<Schema, RowName> = keyof RowWithoutArchived<
		Schema,
		RowName
	>
> {
	private _currentPage = $state(1);
	private _pageSize = $state(10);
	private _totalItems = $state(0);

	// Track exact IDs for the current view, solving the Cache-Slice mismatch
	private _currentPageIds = $state<string[]>([]);

	/**
	 * Creates a pagination controller bound to a query and struct cache.
	 *
	 * @param {SupaQuery<Schema, RowName, Required>} query - Parent query wrapper.
	 * @param {SupaStruct<Schema, RowName>} struct - Owning struct.
	 * @param {(page: number, size: number) => Promise<PaginatedResponse<SupaStructData<Schema, RowName, Required>>>} paginateQuery - Paginated fetch executor.
	 * @example
	 * const pager = new SupaPagination(query, struct, paginate);
	 */
	constructor(
		private readonly struct: SupaStruct<Schema, RowName>,
		private readonly paginateQuery: (
			page: number,
			size: number
		) => Promise<PaginatedResponse<SupaStructData<Schema, RowName, Required>>>
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
	 * @returns {SupaStructData<Schema, RowName, Required>[]} Current page rows from cache.
	 * @example
	 * const rows = pager.reactive;
	 */
	get reactive(): SupaStructData<Schema, RowName, Required>[] {
		return this._currentPageIds
			.map((id) => this.struct.cache.get(id))
			.filter((item) => !!item) as SupaStructData<Schema, RowName, Required>[];
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
	 * @returns {Promise<Result<SupaStructData<Schema, RowName, Required>[], Error>>} Page fetch result.
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
	 * @returns {Promise<Result<SupaStructData<Schema, RowName, Required>[], Error>>} Page fetch result.
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
	 * @returns {Promise<Result<SupaStructData<Schema, RowName, Required>[], Error>>} Page fetch result.
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
	 * @returns {Promise<Result<SupaStructData<Schema, RowName, Required>[], Error>>} Page fetch result.
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
					SupaStructData<Schema, RowName, Required>[],
					Error
				>;
			});
	}

	/**
	 * Executing `await query.paginated` fetches the current page.
	 *
	 * @param {(value: Result<SupaStructData<Schema, RowName, Required>[], Error>) => void | PromiseLike<void> | null} [onfulfilled] - Fulfillment handler.
	 * @returns {Promise<Result<SupaStructData<Schema, RowName, Required>[], Error>>} Pagination result.
	 * @example
	 * const result = await query.paginated;
	 */
	then(
		onfulfilled?:
			| ((
					value: Result<SupaStructData<Schema, RowName, Required>[], Error>
			  ) => void | PromiseLike<void>)
			| null
	) {
		return this.executeFetch().then(onfulfilled);
	}
}

export class SupaStructData<
	Schema extends RowSchemaName,
	RowName extends RowTableNames<Schema>,
	Required extends keyof RowWithoutArchived<Schema, RowName> = keyof RowWithoutArchived<
		Schema,
		RowName
	>,
	UpdateName extends UpdateTableNames<Schema> = Extract<RowName, UpdateTableNames<Schema>>
> {
	public readonly raw: PartialRow<Schema, RowName, Required> = $state({} as any);

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
		data: PartialRow<Schema, RowName, Required>,
		public readonly config?: { is_temporary?: boolean }
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

	get temp() {
		return this.config?.is_temporary ?? false;
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

	_deleteLocal() {
		return attemptAsync(async () => {
			this.struct.cache.delete(String(this.id));
			const dexie = this.struct['getDexie'](this.struct['getSchemaDefinition']().Row as any);

			if (dexie) {
				await dexie['remove'](String(this.id));
			}
		});
	}

	/**
	 * Updates this row in Supabase and merges the returned row into local state.
	 *
	 * @param {Partial<Insert<Schema, UpdateName>>} updates - Patch payload.
	 * @returns {ReturnType<typeof attemptAsync<SupaStructData<Schema, RowName>>>} Async result wrapper.
	 * @example
	 * await item.update({ archived: true });
	 */
	update(updates: Partial<UpdateWithoutArchived<Schema, UpdateName>>) {
		return attemptAsync<SupaStructData<Schema, RowName, Required>, SupaError>(async () => {
			if (!is_online()) {
				this.struct.log('Offline: Skipping Supabase update and only updating local cache');
				Object.assign(this.raw, updates);
				this.struct['set_in_cache'](this as any);
				const offline_updates = await OfflineUpdates.all();
				if (offline_updates.isErr()) {
					throw new SupaError(
						'offline',
						'Failed to retrieve offline updates: ' + offline_updates.error.message
					);
				}
				const [last_update] = offline_updates.value.reverse();
				if (
					last_update &&
					last_update.raw.action === 'update' &&
					last_update.raw.target_id === this.id
				) {
					await last_update.update({
						data: { ...last_update.raw.data, ...updates } as any
					});
					return this;
				}
				await OfflineUpdates.new({
					table: this.struct.table,
					schema: this.struct.schema,
					data: { ...this.raw, ...updates } as any,
					action: 'update',
					target_id: this.id,
					id: `${Math.floor(Math.random() * 1000000)}-${Date.now()}`,
					created_at: new SvelteDate()
				});
				return this;
			}

			const res = await this.struct.supabase
				.schema(this.struct.schema)
				.from(this.struct.table)
				.update(updates as any)
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
			Object.assign(this.raw, updates);
			this.struct['set_in_cache'](this as any);
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
		return attemptAsync<boolean, SupaError>(async () => {
			if (!is_online()) {
				this.struct.log('Offline: Skipping Supabase delete and only updating local cache');
				await this._deleteLocal();
				await OfflineUpdates.new({
					table: this.struct.table,
					schema: this.struct.schema,
					data: { ...this.raw } as any,
					action: 'delete',
					id: `${Math.floor(Math.random() * 1000000)}-${Date.now()}`,
					target_id: this.id,
					created_at: new SvelteDate()
				});
				return true;
			}

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
