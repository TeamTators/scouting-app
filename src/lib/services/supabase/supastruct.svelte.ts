/**
 * @fileoverview
 * Typed Supabase data access helpers with reactive caching, realtime synchronization,
 * query composition, and pagination utilities for Svelte 5 runes-based state.
 *
 * This module is the core data access layer for the app. It combines three ideas:
 * - table-aware typed wrappers (`SupaStruct`) for schema validation and Supabase interaction
 * - reactive, cache-aware query objects (`SupaQuery`) that can hydrate from Dexie, hit Supabase,
 *   and resolve fast from the in-memory cache
 * - row-level helpers (`SupaStructData`) for updating, deleting, and reacting to live data
 *
 * The goal is to keep business logic ergonomic: you create a table struct once, run typed
 * queries against it, and receive `SupaStructData` records that behave like in-memory row models
 * while still being backed by the database.
 *
 * @example
 * const users = SupaStruct.get({
 *   schema: 'core',
 *   table: 'users',
 *   client: supabase,
 *   debug: true
 * });
 *
 * const activeUsers = users.get({ archived: false });
 * const first = await activeUsers.first();
 *
 * @see {@link SupaStruct}
 * @see {@link SupaQuery}
 * @see {@link SupaPagination}
 * @see {@link SupaStructData}
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
// import supabase from "$lib/services/supabase";
import { attempt, attemptAsync, ComplexEventEmitter, type Result, Ok, Err } from 'ts-utils';
import { REALTIME_SUBSCRIBE_STATES, type SupabaseClient } from '@supabase/supabase-js';
import { schemas } from '$lib/types/supabase-zod';
import { z } from 'zod';
import { type Database, type DatabasePivoted, type SchemaName } from '$lib/types/supabase';
import { SvelteMap, SvelteDate, SvelteSet } from 'svelte/reactivity';
import { browser } from '$app/environment';
import { DexieTable } from '$lib/services/db/table';
import { is_online, on_network_change } from '$lib/utils/online.svelte';
import { stable_stringify } from '$lib/utils/json';
import { type RealtimePostgresChangesPayload } from '@supabase/supabase-js';
/**
 * Typed Supabase client for this app with a `serviceRole` flag used for privileged server-side work.
 */
export type Client = SupabaseClient<Database> & { serviceRole: boolean };

/** Schema names that have generated row metadata. */
export type RowSchemaName = keyof DatabasePivoted['Row'];
/** Schema names that have generated insert metadata. */
export type InsertSchemaName = keyof DatabasePivoted['Insert'];
/** Schema names that have generated update metadata. */
export type UpdateSchemaName = keyof DatabasePivoted['Update'];

/**
 * Table names available in a specific row schema.
 *
 * @template S - Schema whose row tables are being queried.
 */
export type RowTableName<S extends RowSchemaName> = keyof DatabasePivoted['Row'][S];
/**
 * Table names available for insert payloads in a specific schema.
 *
 * @template S - Schema whose insert tables are being queried.
 */
export type InsertTableName<S extends InsertSchemaName> = keyof DatabasePivoted['Insert'][S];
/**
 * Table names available for update payloads in a specific schema.
 *
 * @template S - Schema whose update tables are being queried.
 */
export type UpdateTableName<S extends UpdateSchemaName> = keyof DatabasePivoted['Update'][S];

/**
 * Generic row table names for a schema.
 *
 * @template Schema - Database schema to inspect.
 */
export type RowTableNames<Schema extends SchemaName = SchemaName> = RowTableName<Schema>;
/**
 * Generic insert table names for a schema.
 *
 * @template Schema - Database schema to inspect.
 */
export type InsertTableNames<Schema extends SchemaName = SchemaName> = InsertTableName<Schema>;
/**
 * Generic update table names for a schema.
 *
 * @template Schema - Database schema to inspect.
 */
export type UpdateTableNames<Schema extends SchemaName = SchemaName> = UpdateTableName<Schema>;

/**
 * Full typed row shape for a table, including metadata fields added by the schema.
 *
 * @template Schema - Active database schema.
 * @template Name - Table within that schema.
 */
export type Row<
	Schema extends SchemaName,
	Name extends RowTableNames<Schema>
> = DatabasePivoted['Row'][Schema][Name] & {
	id: string;
	created_at: string;
	archived: boolean;
};

/**
 * Typed row shape without the `archived` flag, useful for read and compare operations.
 *
 * @template Schema - Active database schema.
 * @template Name - Table within that schema.
 */
export type RowWithoutArchived<
	Schema extends SchemaName,
	Name extends RowTableNames<Schema>
> = Omit<Row<Schema, Name>, 'archived'>;

/**
 * Typed insert payload for a table.
 *
 * @template Schema - Active database schema.
 * @template Name - Insert table variant.
 */
export type Insert<
	Schema extends SchemaName,
	Name extends InsertTableNames<Schema>
> = DatabasePivoted['Insert'][Schema][Name];

/**
 * Insert payload without the `archived` field.
 *
 * @template Schema - Active database schema.
 * @template Name - Insert table variant.
 */
export type InsertWithoutArchived<
	Schema extends SchemaName,
	Name extends InsertTableNames<Schema>
> = Omit<Insert<Schema, Name>, 'archived'>;

/**
 * Typed update payload for a table.
 *
 * @template Schema - Active database schema.
 * @template Name - Update table variant.
 */
export type Update<
	Schema extends SchemaName,
	Name extends UpdateTableNames<Schema>
> = DatabasePivoted['Update'][Schema][Name] & {
	archived?: boolean;
};

/**
 * Update payload with common system fields removed.
 *
 * @template Schema - Active database schema.
 * @template Name - Update table variant.
 */
export type UpdateWithoutArchived<
	Schema extends SchemaName,
	Name extends UpdateTableNames<Schema>
> = Omit<Update<Schema, Name>, 'archived' | 'id' | 'created_at'>;

/**
 * Partial row object that guarantees a subset of required fields while allowing other values to be missing.
 *
 * @template Schema - Active database schema.
 * @template Name - Table within that schema.
 * @template RequiredFields - Fields that must be present in the partial object.
 */
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
 * Runtime configuration object passed to a struct instance.
 *
 * @template Schema - Active database schema.
 * @template Name - Table handled by the struct.
 */
export type SupaConfig<Schema extends RowSchemaName, Name extends RowTableNames<Schema>> = {
	/**
	 * Table name in the active schema.
	 */
	table: Name;
	/**
	 * Supabase client used for networking, realtime events, and offline replay.
	 */
	client: Client;
	/**
	 * Active database schema for the table.
	 */
	schema: Schema;
	/**
	 * Enables debug logging scoped to this struct instance.
	 */
	debug?: boolean;
	/**
	 * Enables IndexedDB-backed local persistence for this struct.
	 */
	index_db?: boolean;
	/**
	 * Controls whether the struct is registered in the shared in-memory registry.
	 *
	 * Defaults to `true` when not explicitly disabled.
	 */
	do_set?: boolean;
};

/**
 * A readonly list of required row properties.
 *
 * @template Schema - Active database schema.
 * @template Name - Table within that schema.
 */
export type RequiredList<
	Schema extends RowSchemaName,
	Name extends RowTableNames<Schema>
> = readonly (keyof Row<Schema, Name>)[];

/**
 * Resolves the actual required fields for a query projection.
 *
 * @template Schema - Active database schema.
 * @template Name - Table within that schema.
 * @template Required - Requested field list, if any.
 */
export type ResolveRequiredFields<
	Schema extends RowSchemaName,
	Name extends RowTableNames<Schema>,
	Required extends RequiredList<Schema, Name> | undefined
> = Required extends readonly (infer K)[]
	? Extract<K, keyof Row<Schema, Name>> | 'id'
	: keyof Row<Schema, Name>;

/**
 * Type-level guard that ensures a field set includes a required subset.
 */
export type HasAtLeastRequiredFields<Have extends PropertyKey, Need extends PropertyKey> = [
	Need
] extends [Have]
	? true
	: false;

/**
 * Type-level helper that narrows a field set to a valid required subset.
 */
export type EnsureHasAtLeastRequiredFields<Have extends PropertyKey, Need extends PropertyKey> = [
	Need
] extends [Have]
	? Have
	: never;

/**
 * Fetch read options for a single query.
 *
 * @template Schema - Active database schema.
 * @template Name - Table within that schema.
 * @template Required - Field projection type.
 */
export type ReadConfig<
	Schema extends RowSchemaName,
	Name extends RowTableNames<Schema>,
	Required extends keyof RowWithoutArchived<Schema, Name> = keyof RowWithoutArchived<Schema, Name>
> = {
	/**
	 * Explicit field projection to include in the read result.
	 *
	 * If omitted, the query loads the table's default required fields.
	 */
	only?: readonly Required[];
};

/**
 * Normalized error codes emitted by the Supabase layer.
 */
export type SupaErrorCode =
	| 'invalid data'
	| 'no schema'
	| 'no table'
	| 'unauthorized'
	| 'unknown'
	| 'network'
	| 'timeout'
	| 'offline'
	| 'no dexie';

/**
 * Structured error wrapper for Supabase failures.
 *
 * @extends Error
 * @example
 * throw new SupaError('unauthorized', 'The current user cannot read this table');
 */
class SupaError extends Error {
	/**
	 * Error code describing the failure classification.
	 */
	constructor(
		public readonly code: SupaErrorCode,
		message?: string
	) {
		super(message ?? `SupaStruct query error: ${code}`);
	}
}

/**
 * IndexedDB queue used to persist offline write actions until connectivity is restored.
 */
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

/**
 * Increment when the serialized query cache format changes.
 */
const QUERY_CACHE_VERSION = 1;
/**
 * IndexedDB table storing query sync metadata for TTL-based refresh behavior.
 */
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

/**
 * Global guard to avoid registering duplicate offline listeners.
 */
let offline_setup = false;

/**
 * Returns true when running under test environments.
 *
 * @returns {boolean} Whether current runtime appears to be tests.
 */
const _is_test_runtime = () => {
	if (typeof process === 'undefined') return false;
	return process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';
};

/**
 * Initializes the offline queue replay listener for this Supabase client.
 *
 * When connectivity returns, the app replays queued local insert/update/delete operations
 * stored in IndexedDB so the server state and the local cache converge.
 *
 * @param {Client} client - Supabase client used to replay queued actions.
 * @returns {() => void} Cleanup callback that disables the listener.
 */
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

/**
 * Supported field comparison operators for the legacy realtime filter syntax.
 */
type Condition = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike';

/**
 * PostgREST filter template used by realtime subscriptions.
 *
 * @template S - Active schema.
 * @template T - Target table within the schema.
 */
type Filter<S extends RowSchemaName, T extends RowTableNames<S>> =
	| `${Extract<keyof Row<S, T>, string>}=${Condition}.${string}`
	| `${Extract<keyof Row<S, T>, string>}=in.(${string})`
	| '*';

/**
 * Realtime subscription descriptor for channel registration.
 *
 * @template S - Active schema.
 * @template T - Target table within the schema.
 */
type Subscription<S extends RowSchemaName, T extends RowTableNames<S>> = {
	/**
	 * Realtime filter string or wildcard selector.
	 */
	filter: Filter<S, T> | string;
	/**
	 * Callback executed whenever a matching payload arrives.
	 */
	callback?: (payload: RealtimePostgresChangesPayload<RowWithoutArchived<S, T>>) => void;
	/**
	 * Struct associated with the subscription target table.
	 */
	struct: SupaStruct<S, T>;
};

/**
 * Active subscriptions keyed by `schema.table`.
 */
const subscriptions = new SvelteMap<
	`${string}.${string}`,
	Subscription<RowSchemaName, RowTableNames<RowSchemaName>>
>();

/**
 * Debounce timer used while rebuilding realtime channel bindings.
 */
let subscribe_timeout: ReturnType<typeof setTimeout> | null = null;
/**
 * Rebuilds the shared realtime channel from currently tracked subscriptions.
 *
 * @param {Client} client - Supabase client used for channel management.
 * @returns {void}
 */
const reset_realtime = (client: Client) => {
	if (subscribe_timeout) clearTimeout(subscribe_timeout);
	subscribe_timeout = setTimeout(async () => {
		// stop subscription and reset
		const _responses = await client.removeAllChannels();

		const channel = client.channel('table-db-changes');

		for (const subscription of subscriptions.values()) {
			channel.on(
				'postgres_changes',
				{
					event: '*',
					schema: subscription.struct.schema,
					table: subscription.struct.table,
					filter: subscription.filter === '*' ? undefined : subscription.filter
				},
				(payload) => {
					subscription.struct.log('Recieved realtime payload:', payload);
					subscription.callback?.(payload as any);
					switch (payload.eventType) {
						case 'INSERT':
							{
								subscription.struct.Generator(payload.new as any);
							}
							break;
						case 'UPDATE':
							{
								subscription.struct.Generator(payload.new as any);
							}
							break;
						case 'DELETE':
							{
								subscription.struct.cache.delete(String(payload.old.id));
							}
							break;
					}
				}
			);
		}

		channel.subscribe((status, err) => {
			if (status === 'SUBSCRIBED') {
				console.log('Realtime subscription status: SUBSCRIBED');
			} else {
				console.log('Realtime subscription status:', status, 'Error:', err);
			}
		});
	}, 0);
};

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
			/**
			 * Field to compare.
			 */
			field: keyof RowWithoutArchived<Schema, Name>;
			/**
			 * Comparison operator used for the field match.
			 */
			operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in';
			/**
			 * Expected value or list of values for the comparison.
			 */
			value:
				| RowWithoutArchived<Schema, Name>[keyof RowWithoutArchived<Schema, Name>]
				| RowWithoutArchived<Schema, Name>[keyof RowWithoutArchived<Schema, Name>][];
	  }
	| {
			/**
			 * Group operator used to combine child search nodes.
			 */
			type: 'and' | 'or';
			/**
			 * Child search nodes combined under this group.
			 */
			conditions: SearchQuery<Schema, Name>[];
	  };

/**
 * Registers a realtime descriptor and refreshes channel bindings.
 *
 * @template S - Active schema.
 * @template T - Target table.
 * @param {Client} client - Supabase client used for channel registration.
 * @param {Subscription<S, T>} subscription - Subscription descriptor to register.
 * @returns {ReturnType<typeof attemptAsync<void>>} Async registration result.
 */
const add_subscription = <S extends RowSchemaName, T extends RowTableNames<S>>(
	client: Client,
	subscription: Subscription<S, T>
) => {
	return attemptAsync(async () => {
		console.log('Adding subscription:', subscription);
		subscriptions.set(
			`${subscription.struct.schema}.${String(subscription.struct.table)}`,
			subscription as any
		);
		reset_realtime(client);
	});
};

/**
 * Represents a typed table adapter for a Supabase schema/table pair.
 *
 * A `SupaStruct` owns:
 * - the configured Supabase client and schema/table routing
 * - a reactive in-memory cache for row objects
 * - Dexie-backed hydration for local persistence
 * - a set of query builders such as `get`, `getOR`, `search`, `all`, and `join`
 * - row wrappers created via `Generator` and `Hydrate`
 *
 * Use a single struct per table to keep query creation consistent and cache keys stable.
 *
 * @template Schema - Database schema name.
 * @template RowName - Table name within that schema.
 *
 * @example
 * const profiles = SupaStruct.get({
 *   schema: 'core',
 *   table: 'profile',
 *   client: supabase
 * });
 *
 * const query = profiles.get({ archived: false, role: 'admin' });
 * const admins = await query;
 */
export class SupaStruct<Schema extends RowSchemaName, RowName extends RowTableNames<Schema>> {
	/**
	 * Shared registry of active table structs keyed by schema and table name.
	 */
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	public static readonly structs = new Map<
		string,
		SupaStruct<RowSchemaName, RowTableNames<RowSchemaName>>
	>();

	/**
	 * Creates a struct instance for a table.
	 *
	 * @template Name - Target table name.
	 * @template Schema - Target schema name.
	 * @param config - Struct runtime configuration.
	 * @returns A new typed `SupaStruct` instance.
	 *
	 * @example
	 * const users = SupaStruct.get({
	 *   name: 'profile',
	 *   schema: 'core',
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
			instance.initializeCache();
		} catch {
			//
		}
		return instance;
	}

	/**
	 * Initializes the shared realtime listener for the supplied client.
	 *
	 * @param {Client} client - Supabase client that should own the channel bindings.
	 * @returns {void}
	 */
	public static initRealtime(client: Client) {
		reset_realtime(client);
	}

	/**
	 * Stops any queued realtime rebind and clears active channel subscriptions.
	 *
	 * @returns {void}
	 */
	public static stopRealtime() {
		if (subscribe_timeout) {
			clearTimeout(subscribe_timeout);
			subscribe_timeout = null;
		}
	}

	/**
	 * In-memory cache for this table's wrapped row objects.
	 */
	public readonly cache = $state(new SvelteMap<string, SupaStructData<Schema, RowName, 'id'>>());
	/**
	 * Event emitter used to broadcast lifecycle and realtime notifications for this table.
	 */
	private readonly em = new ComplexEventEmitter<{
		new: [SupaStructData<Schema, RowName>];
		update: [SupaStructData<Schema, RowName>, Row<Schema, RowName>];
		delete: [SupaStructData<Schema, RowName>];
		archive: [SupaStructData<Schema, RowName>];
		restore: [SupaStructData<Schema, RowName>];
		realtime: [REALTIME_SUBSCRIBE_STATES];
	}>();
	/**
	 * Registers a listener for emitted row and realtime events.
	 */
	public readonly on = this.em.on.bind(this.em);
	/**
	 * Removes a listener from the event emitter.
	 */
	public readonly off = this.em.off.bind(this.em);
	/**
	 * Registers a one-time listener for emitted row and realtime events.
	 */
	public readonly once = this.em.once.bind(this.em);

	/**
	 * Creates a typed table struct.
	 *
	 * @param {SupaConfig<Schema, RowName>} config - Runtime table, schema, and client configuration.
	 * @example
	 * const profiles = new SupaStruct({ schema: 'core', table: 'profile', client: supabase });
	 */
	constructor(public readonly config: SupaConfig<Schema, RowName>) {}

	/**
	 * Stores a wrapped row in the in-memory cache when browser-mode caching is enabled.
	 *
	 * @param {SupaStructData<Schema, RowName, 'id'>} data - Row wrapper to cache.
	 * @returns {void}
	 */
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

	/**
	 * Indicates whether the local Dexie cache for this table has already been initialized.
	 */
	private _initializedCache = false;
	/**
	 * Initializes the local Dexie cache metadata for this table.
	 *
	 * @returns {void}
	 */
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

	/**
	 * Resolves the generated Zod schema definition for the struct's table.
	 *
	 * @returns {{ Row: z.ZodObject<z.ZodRawShape> }} The row schema definition.
	 * @throws {Error} When no schema exists for the configured table.
	 */
	getSchemaDefinition(): {
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

	/**
	 * Returns the non-null, non-optional row keys for this table in priority order.
	 *
	 * @returns {(keyof RowWithoutArchived<Schema, RowName>)[]} Required row keys, always including `id`.
	 */
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

	/**
	 * Normalizes a requested field list so it always contains the stable row id.
	 *
	 * @template Required - Requested field keys.
	 * @param {readonly Required[]} [required] - Requested projection fields.
	 * @returns {(Required | 'id')[] | (keyof RowWithoutArchived<Schema, RowName>)[]} Required field list with `id` forced in.
	 */
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

	/**
	 * Converts a requested field list into a PostgREST select clause string.
	 *
	 * @template Required - Requested field keys.
	 * @param {readonly Required[]} [required] - Fields to project.
	 * @returns {string} PostgREST-compatible select string.
	 */
	private buildSelectClause<Required extends keyof RowWithoutArchived<Schema, RowName>>(
		required?: readonly Required[]
	) {
		if (!required) {
			return '*';
		}
		const fields = this.getEffectiveRequiredFields(required);
		return fields.map((field) => String(field)).join(',');
	}

	/**
	 * Escapes a raw value into a quoted PostgREST literal.
	 *
	 * @param {unknown} value - Value to serialize.
	 * @returns {string} Serialized literal.
	 */
	private toPostgrestLiteral(value: unknown) {
		if (value === null) return 'null';
		if (typeof value === 'number' || typeof value === 'boolean') {
			return String(value);
		}

		const str = typeof value === 'string' ? value : JSON.stringify(value);
		return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
	}

	/**
	 * Returns the Dexie table instance for this struct, creating it when needed.
	 *
	 * @param {z.ZodType<RowWithoutArchived<Schema, RowName>>} schema - Row schema for the Dexie table.
	 * @param {boolean} [initialize=false] - Whether to initialize cache state before returning.
	 * @returns {ReturnType<typeof DexieTable.get> | undefined} Dexie table instance in browser mode.
	 */
	getDexie(schema: z.ZodType<RowWithoutArchived<Schema, RowName>>, initialize = false) {
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

			// Validate each returned row includes required projected fields before hydration.
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
	 * Returns the configured table name.
	 *
	 * @returns {Extract<RowName, string>} String table name.
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

	/**
	 * Hydrates raw row payloads into the struct cache and Dexie store.
	 *
	 * This method is the main normalization point for query results. It validates, wraps, and caches
	 * rows so downstream code receives stable `SupaStructData` instances instead of raw objects.
	 *
	 * @template Required - Fields considered required during hydration.
	 * @param {PartialRow<Schema, RowName, Required | 'id'>[]} rows - Row payloads to hydrate.
	 * @param {readonly Required[]} [required] - Requested field projection for validation.
	 * @param {(data: SupaStructData<Schema, RowName, Required | 'id'>) => boolean} [satisfies] - Optional predicate used to prune stale cache entries.
	 * @returns {SupaStructData<Schema, RowName, Required | 'id'>[]} Wrapped rows in cache order.
	 * @example
	 * const hydrated = users.Hydrate([
	 *   { id: '1', archived: false, email: 'a@example.com' }
	 * ]);
	 */
	Hydrate<
		Required extends keyof RowWithoutArchived<Schema, RowName> =
			'id' | keyof RowWithoutArchived<Schema, RowName>
	>(
		rows: PartialRow<Schema, RowName, Required | 'id'>[],
		required?: readonly Required[],
		satisfies?: (data: SupaStructData<Schema, RowName, Required | 'id'>) => boolean
	) {
		this.log(`Hydrating ${rows.length} rows into cache for table ${this.table}`, rows);
		const hydrated = rows.map((row) => this.Generator(row, { required }));

		let to_delete: string[] = [];

		if (satisfies) {
			// if a value is in the cache and satisfies the provided function but is not in the hydrated results, remove it from the cache and delete it from dexie
			const hydratedIds = new SvelteSet(hydrated.map((data) => String(data.raw.id)));
			to_delete = Array.from(this.cache.values())
				.filter((data) => satisfies(data as any) && !hydratedIds.has(String(data.raw.id)))
				.map((d) => String(d.raw.id));

			for (const data of to_delete) {
				this.log(`Removing row with id ${data} from cache and IndexedDB for table ${this.table}`);
				this.cache.delete(data);
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

			dexie.delete_by_ids(to_delete).then((res) => {
				if (res.isOk()) {
					this.log(`Deleted ${res.value} rows from IndexedDB for table ${this.table}`);
				} else {
					this.log('Error deleting rows from IndexedDB:', res.error);
				}
				this.log(
					`Finished deleting ${to_delete.length} rows from IndexedDB for table ${this.table}`
				);
				to_delete = [];
			});
		}

		return hydrated;
	}

	/**
	 * Joins this table with another struct using an inner relationship and returns a query wrapper.
	 *
	 * This method attempts to hydrate from the Dexie cache first and falls back to a Supabase join when needed.
	 * It is useful for pulling rows from related tables with a stable left/right projection.
	 *
	 * @template OtherSchema - Foreign schema.
	 * @template OtherRowName - Foreign table name.
	 * @template RequiredA - Fields requested from the left table.
	 * @template RequiredB - Fields requested from the right table.
	 * @param {SupaStruct<OtherSchema, OtherRowName>} other - Target table to join against.
	 * @param {{ requiredA?: readonly RequiredA[]; whereB?: Partial<RowWithoutArchived<OtherSchema, OtherRowName>>; joinOn?: { left: keyof RowWithoutArchived<Schema, RowName>; right: keyof RowWithoutArchived<OtherSchema, OtherRowName> }; pullB?: boolean; requiredB?: readonly RequiredB[]; }} [config] - Join configuration.
	 * @returns {SupaQuery<Schema, RowName, RequiredA | 'id'>} Query wrapper for the joined result set.
	 * @throws {Error} When the join spans different schemas.
	 */
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
	): JoinQuery<Schema, RowName, OtherSchema, OtherRowName, RequiredA, RequiredB> {
		if (String(this.schema) !== String(other.schema)) {
			throw new Error(
				`Cannot join tables from different schemas: ${this.schema} and ${other.schema}`
			);
		}
		return new JoinQuery(this, other, config);
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
		const conditions = Object.entries(queryData)
			.filter(([, value]) => value !== undefined)
			.map(([field, value]) => ({
				field: field as keyof RowWithoutArchived<Schema, RowName>,
				operator: 'eq' as const,
				value: value as any
			}));
		const search: SearchQuery<Schema, RowName> | '*' = conditions.length
			? { type: 'and', conditions }
			: '*';

		return new SupaQuery(this, search, required);
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
		const conditions = Object.entries(queryData)
			.filter(([, value]) => value !== undefined)
			.map(([field, value]) => ({
				field: field as keyof RowWithoutArchived<Schema, RowName>,
				operator: 'eq' as const,
				value: value as any
			}));
		const search: SearchQuery<Schema, RowName> | '*' = conditions.length
			? { type: 'and', conditions }
			: '*';

		return new SupaQuery(this, search, required);
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
		return new SupaQuery(this, query, required);
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

	/**
	 * Builds a query by a set of row ids.
	 *
	 * @template Required - Fields to project for each row.
	 * @param {string[]} ids - Row ids to resolve.
	 * @param {ReadConfig<Schema, RowName, Required>} [config] - Optional projection config.
	 * @returns {SupaQuery<Schema, RowName, Required | 'id'>} Query that resolves matching rows.
	 * @example
	 * const query = users.fromIds(['a', 'b', 'c']);
	 * const rows = await query;
	 */
	fromIds<
		Required extends keyof RowWithoutArchived<Schema, RowName> = keyof RowWithoutArchived<
			Schema,
			RowName
		>
	>(ids: string[], config?: ReadConfig<Schema, RowName, Required>) {
		const required = this.getEffectiveRequiredFields(config?.only) as readonly (Required | 'id')[];
		const search: SearchQuery<Schema, RowName> = {
			field: 'id' as keyof RowWithoutArchived<Schema, RowName>,
			operator: 'in',
			value: ids as any
		};
		return new SupaQuery(this, search, required);
	}

	/**
	 * Inserts one or more rows and returns hydrated wrappers.
	 *
	 * Rows are first hydrated into local cache (and Dexie when enabled), then inserted
	 * into Supabase when online. On insert failure, temporary local rows are removed.
	 *
	 * @param {...Insert<Schema, Extract<RowName, InsertTableNames<Schema>>>} data - Row insert payloads.
	 * @returns {ReturnType<typeof attemptAsync<SupaStructData<Schema, RowName, 'id' | keyof RowWithoutArchived<Schema, RowName>>[], SupaError>>} Async inserted-row result.
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
		return new SupaQuery(this, '*', required);
	}
}

// Define a type for the paginated response that includes the total count
/**
 * Response shape for a single paginated fetch.
 */
type PaginatedResponse<T> = { data: T[]; count: number };

/**
 * Query wrapper for non-join table reads.
 *
 * It builds Supabase queries from `filters`, hydrates local cache from Dexie first,
 * supports pagination/count/sync helpers, and resolves to wrapped row models.
 *
 * @template Schema - Active schema.
 * @template RowName - Target table.
 * @template Required - Required projected fields.
 * @template HasDefault - Whether `default()` was called.
 */
class SupaQuery<
	Schema extends RowSchemaName,
	RowName extends RowTableNames<Schema>,
	Required extends keyof RowWithoutArchived<Schema, RowName> = keyof RowWithoutArchived<
		Schema,
		RowName
	>,
	HasDefault extends boolean = false
> {
	private _default: SupaStructData<Schema, RowName, Required> | null = null;

	private _sort: (
		a: SupaStructData<Schema, RowName, Required>,
		b: SupaStructData<Schema, RowName, Required>
	) => number = $state((a, b) => {
		if (String(a.id) < String(b.id)) return -1;
		if (String(a.id) > String(b.id)) return 1;
		return 0;
	});

	private _reverse = $state(false);

	// private readonly em = new ComplexEventEmitter<{
	// 	error: [SupaError];
	// 	cache: [SupaStructData<Schema, RowName, Required>[]];
	// 	fetch: [SupaStructData<Schema, RowName, Required>[]];
	// 	dexie: [SupaStructData<Schema, RowName, Required>[]];
	// }>();

	/**
	 * Creates a non-join query wrapper for a struct.
	 *
	 * @param {SupaStruct<Schema, RowName>} struct - Owning table struct.
	 * @param {SearchQuery<Schema, RowName> | '*'} filters - Search filter tree or wildcard selector.
	 * @param {readonly Required[]} required - Required projection fields for hydration.
	 */
	constructor(
		public readonly struct: SupaStruct<Schema, RowName>,
		public readonly filters: SearchQuery<Schema, RowName> | '*',
		public readonly required: readonly Required[]
	) {}

	/**
	 * Evaluates whether a cached row matches the current search filter.
	 *
	 * @param {SupaStructData<Schema, RowName, Required>} data - Row wrapper to evaluate.
	 * @returns {boolean} True when row satisfies current filters.
	 */
	private matches_filter(data: SupaStructData<Schema, RowName, Required>): boolean {
		if (this.filters === '*') return true;

		const evaluate = (filter: SearchQuery<Schema, RowName>): boolean => {
			if ('field' in filter) {
				const value = data.raw[filter.field as keyof RowWithoutArchived<Schema, RowName>] as any;
				if (value === undefined || value === null) return false;

				switch (filter.operator) {
					case 'eq':
						return value === filter.value;
					case 'neq':
						return value !== filter.value;
					case 'gt':
						return Number(value) > Number(filter.value);
					case 'lt':
						return Number(value) < Number(filter.value);
					case 'gte':
						return Number(value) >= Number(filter.value);
					case 'lte':
						return Number(value) <= Number(filter.value);
					case 'like': {
						if (typeof value !== 'string' || typeof filter.value !== 'string') return false;
						return value.includes(filter.value.replaceAll('%', ''));
					}
					case 'ilike': {
						if (typeof value !== 'string' || typeof filter.value !== 'string') return false;
						return value.toLowerCase().includes(filter.value.replaceAll('%', '').toLowerCase());
					}
					case 'in':
						return Array.isArray(filter.value) && filter.value.includes(value as never);
					default:
						return false;
				}
			}

			if (filter.type === 'and') {
				return filter.conditions.every(evaluate);
			}

			return filter.conditions.some(evaluate);
		};

		return evaluate(this.filters);
	}

	/**
	 * Escapes values for realtime PostgREST filter serialization.
	 *
	 * @param {unknown} value - Value to normalize.
	 * @returns {string} Serialized representation.
	 */
	private normalize_realtime_value(value: unknown) {
		if (value === null) return 'null';
		if (typeof value === 'number' || typeof value === 'boolean') return String(value);
		if (typeof value === 'string') return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
		return JSON.stringify(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
	}

	/**
	 * Converts nested filter objects into realtime filter strings.
	 *
	 * @param {SearchQuery<Schema, RowName> | '*'} filter - Query filter.
	 * @returns {string} Realtime filter expression.
	 */
	private build_realtime_string(filter: SearchQuery<Schema, RowName> | '*'): string {
		if (filter === '*') return '*';

		const walk = (node: SearchQuery<Schema, RowName>): string => {
			if ('field' in node) {
				const value = Array.isArray(node.value)
					? `(${node.value.map((v) => this.normalize_realtime_value(v)).join(',')})`
					: this.normalize_realtime_value(node.value);

				switch (node.operator) {
					case 'in':
						return `${String(node.field)}=in.(${Array.isArray(node.value) ? node.value.map((v) => this.normalize_realtime_value(v)).join(',') : this.normalize_realtime_value(node.value)})`;
					case 'like':
						return `${String(node.field)}=like.${value}`;
					case 'ilike':
						return `${String(node.field)}=ilike.${value}`;
					default:
						return `${String(node.field)}=${node.operator}.${value}`;
				}
			}

			return `(${node.conditions.map(walk).join(',')})`;
		};

		return walk(filter);
	}

	/**
	 * Reactive rows currently matching this query from in-memory cache.
	 *
	 * @returns {SupaStructData<Schema, RowName, Required>[]} Sorted matching rows.
	 */
	get reactive(): SupaStructData<Schema, RowName, Required>[] {
		const rows = Array.from(this.struct.cache.values()).filter((item) =>
			this.matches_filter(item as any)
		);
		return rows.sort((a, b) => (this._reverse ? -1 : 1) * this._sort(a as any, b as any)) as SupaStructData<Schema, RowName, Required>[];
	}

	/**
	 * First matching row or the configured default when present.
	 *
	 * @returns {SupaStructData<Schema, RowName, Required> | null} Selected row.
	 */
	get single(): HasDefault extends true
		? SupaStructData<Schema, RowName, Required>
		: SupaStructData<Schema, RowName, Required> | null {
		const [[first], last] = [this.reactive, this._default];
		if (first) return first as any;
		if (last) return last as any;
		return null as any;
	}

	/**
	 * Pagination adapter for on-demand page fetches.
	 *
	 * @returns {{ page: (page: number, size: number) => Promise<PaginatedResponse<SupaStructData<Schema, RowName, Required>>> }} Page fetch facade.
	 */
	get paginated() {
		return {
			page: async (page: number, size: number) => {
				const res = await this.fetch_paginated(page, size);
				if (res.isErr()) throw res.error;
				return res.value;
			}
		};
	}

	/**
	 * Sets custom sort comparator for `reactive` rows.
	 *
	 * @param {(a: SupaStructData<Schema, RowName, Required>, b: SupaStructData<Schema, RowName, Required>) => number} sort - Comparator.
	 * @returns {SupaQuery<Schema, RowName, Required, HasDefault>} Current query instance.
	 */
	sort(
		sort: (
			a: SupaStructData<Schema, RowName, Required>,
			b: SupaStructData<Schema, RowName, Required>
		) => number
	) {
		this._sort = sort;
		return this;
	}

	/**
	 * Toggles reverse ordering for `reactive` rows.
	 *
	 * @returns {SupaQuery<Schema, RowName, Required, HasDefault>} Current query instance.
	 */
	reverse() {
		this._reverse = !this._reverse;
		return this;
	}

	/**
	 * Pulls matching rows from Dexie and hydrates the in-memory cache.
	 *
	 * @returns {ReturnType<typeof attemptAsync<SupaStructData<Schema, RowName, Required>[]>>} Dexie hydration result.
	 */
	private pull_dexie() {
		return attemptAsync(async () => {
			const dexie = this.struct.getDexie(this.struct.getSchemaDefinition().Row as any);
			if (!dexie) return [] as SupaStructData<Schema, RowName, Required>[];

			const rows =
				this.filters === '*' ? await dexie.all() : await dexie.search(this.filters as any);
			if (rows.isErr()) return [] as SupaStructData<Schema, RowName, Required>[];

			const hydrated = this.struct.Hydrate(
				rows.value.map((row) => row.raw as any),
				this.required as any
			) as SupaStructData<Schema, RowName, Required>[];

			return hydrated.filter((data) => this.matches_filter(data));
		});
	}

	/**
	 * Builds Supabase query and companion realtime filter from current `filters`.
	 *
	 * @param {'exact' | 'estimated' | 'planned'} [count] - Optional count mode.
	 * @returns {{ query: any; realtime: string; select: string[] }} Query bundle.
	 */
	private build(count?: 'exact' | 'estimated' | 'planned') {
		const fields = Array.from(
			new SvelteSet([...this.required.map(String), 'id', 'archived'])
		) as string[];
		const query = this.struct.supabase
			.schema(this.struct.schema)
			.from(this.struct.table)
			.select(fields.join(','), {
				count
			})
			.filter('archived', 'eq', false);

		if (this.filters === '*') {
			return { query, realtime: '*', select: fields };
		}

		type QueryBuilder = typeof query;

		const apply = (builder: QueryBuilder, node: SearchQuery<Schema, RowName>): QueryBuilder => {
			if ('field' in node) {
				const field = String(node.field);
				const value = node.value;
				if (node.operator === 'in') {
					if (!Array.isArray(value)) return builder;
					return builder.filter(
						field,
						'in',
						value as readonly (string | number | boolean | null | Record<string, unknown>)[]
					);
				}
				return builder.filter(
					field,
					node.operator,
					value as string | number | boolean | null | Record<string, unknown>
				);
			}

			if (node.type === 'and') {
				for (const condition of node.conditions) {
					builder = apply(builder, condition);
				}
				return builder;
			}

			const orParts = node.conditions
				.map((condition) => {
					if (!('field' in condition)) return null;
					const field = String(condition.field);
					const value = condition.value;
					if (condition.operator === 'in') {
						if (!Array.isArray(value)) return null;
						return `${field}.in.(${value.map((v) => String(v)).join(',')})`;
					}
					return `${field}.${condition.operator}.${this.normalize_realtime_value(value)}`;
				})
				.filter(Boolean)
				.join(',');

			return orParts ? builder.or(orParts) : builder;
		};

		return {
			query: apply(query, this.filters),
			realtime: this.build_realtime_string(this.filters),
			select: fields
		};
	}

	/**
	 * Fetches all rows from Supabase and hydrates cache.
	 *
	 * @returns {ReturnType<typeof attemptAsync<SupaStructData<Schema, RowName, Required>[]>>} Result containing all matching rows.
	 */
	fetch_all() {
		return attemptAsync(async () => {
			await this.pull_dexie();
			const built = this.build();
			const res = await built.query;
			const result = this.struct
				.runTransaction({ data: res.data as any, error: res.error }, 'array', this.required as any)
				.unwrap();

			const hydrated = this.struct.Hydrate(result as any, this.required as any) as SupaStructData<
				Schema,
				RowName,
				Required
			>[];

			return hydrated.filter((data) => this.matches_filter(data));
		});
	}

	/**
	 * Fetches a specific page directly from Supabase.
	 *
	 * @param {number} page - 1-based page number.
	 * @param {number} size - Items per page.
	 * @returns {ReturnType<typeof attemptAsync<PaginatedResponse<SupaStructData<Schema, RowName, Required>>>>} Paginated result.
	 */
	fetch_paginated(page: number, size: number) {
		return attemptAsync(async () => {
			await this.pull_dexie();
			const built = this.build();
			const from = (page - 1) * size;
			const to = from + size - 1;
			const res = await built.query.range(from, to);
			const result = this.struct
				.runTransaction({ data: res.data as any, error: res.error }, 'array', this.required as any)
				.unwrap();

			const hydrated = this.struct.Hydrate(result as any, this.required as any) as SupaStructData<
				Schema,
				RowName,
				Required
			>[];

			return {
				data: hydrated.filter((data) => this.matches_filter(data)),
				count: res.count ?? hydrated.length
			};
		});
	}

	/**
	 * Counts rows matching the current query.
	 *
	 * @returns {ReturnType<typeof attemptAsync<number>>} Total count.
	 */
	count() {
		return attemptAsync(async () => {
			const { count, error } = await this.build('exact').query.limit(0);
			if (error) throw error;
			return count ?? 0;
		});
	}

	/**
	 * Fetches first or last row based on `created_at` ordering.
	 *
	 * @param {'first' | 'last'} type - Selection direction.
	 * @returns {ReturnType<typeof attemptAsync<SupaStructData<Schema, RowName, Required> | null>>} Selected row.
	 */
	private fetch_single(type: 'first' | 'last') {
		return attemptAsync(async () => {
			const built = this.build();
			const res = await built.query.limit(1).order('created_at', {
				ascending: type === 'first' ? true : false
			});
			const result = this.struct
				.runTransaction({ data: res.data as any, error: res.error }, 'array', this.required as any)
				.unwrap();

			const hydrated = this.struct.Hydrate(result as any, this.required as any) as SupaStructData<
				Schema,
				RowName,
				Required
			>[];

			return hydrated.find((data) => this.matches_filter(data)) ?? null;
		});
	}

	/**
	 * Fetches earliest row for the current query.
	 *
	 * @returns {ReturnType<typeof attemptAsync<SupaStructData<Schema, RowName, Required> | null>>} Selected row.
	 */
	first() {
		return this.fetch_single('first');
	}

	/**
	 * Fetches latest row for the current query.
	 *
	 * @returns {ReturnType<typeof attemptAsync<SupaStructData<Schema, RowName, Required> | null>>} Selected row.
	 */
	last() {
		return this.fetch_single('last');
	}

	/**
	 * Syncs query with cache TTL semantics.
	 *
	 * Flow: pull Dexie -> check query cache freshness -> fetch remote when stale -> upsert query cache row.
	 *
	 * @param {number} ttl - Cache freshness window in milliseconds.
	 * @returns {Promise<any>} Fresh query result.
	 */
	sync(ttl: number) {
		return this.pull_dexie().then(async () => {
			if (!browser) {
				return this.fetch_all();
			}

			const query_key = stable_stringify({
				schema: this.struct.schema,
				table: this.struct.table,
				filters: this.filters,
				required: this.required.map(String)
			});
			console.log('Query Key:', query_key)
			const cache_row_id = `${this.struct.schema}:${this.struct.table}:${query_key}`;
			console.log('Cache Row ID:', cache_row_id)
			const cached = await QueryCache.get({
				query: query_key,
				schema: this.struct.schema,
				table: this.struct.table
			}).first();
			console.log('Cached: ', cached)
			console.log('Now:', Date.now())

			if (cached.isOk() && cached.value) {
				if (cached.value.raw.version !== QUERY_CACHE_VERSION) {
					await cached.value.delete();
				} else if (Date.now() - cached.value.raw.last_sync <= ttl) {
					console.log('Cache is fresh, using reactive data.');
					return this.reactive;
				}
			}

			const built = this.build();
			const res = await built.query;
			console.log('Supabase query', res);
			const result = this.struct
				.runTransaction({ data: res.data as any, error: res.error }, 'array', this.required as any)
				.unwrap();

			const hydrated = this.struct.Hydrate(result as any, this.required as any, data => this.matches_filter(data)) as SupaStructData<
				Schema,
				RowName,
				Required
			>[];
			console.log('Hydrated', hydrated);

			await QueryCache.upsert({
				query: query_key,
				schema: this.struct.schema,
				table: this.struct.table,
				version: QUERY_CACHE_VERSION,
				required: this.required.map(String).join(','),
				last_sync: Date.now(),
				created_at: new SvelteDate(),
				id: cache_row_id
			});

			return hydrated.filter((data) => this.matches_filter(data));
		});
	}

	/**
	 * Registers a realtime subscription for this query filter.
	 *
	 * @param {(data: SupaStructData<Schema, RowName, Required>, event: 'UPDATE' | 'INSERT' | 'DELETE') => void} [_callback] - Optional event handler.
	 * @returns {() => void} Unsubscribe callback.
	 */
	subscribe(
		_callback?: (
			data: SupaStructData<Schema, RowName, Required>,
			event: 'UPDATE' | 'INSERT' | 'DELETE'
		) => void
	) {
		const realtime = this.build().realtime;
		// if (realtime === '*' && callback) {
		// 		for (const row of this.reactive) {
		// 			callback(row as SupaStructData<Schema, RowName, Required>, 'INSERT');
		// 		}
		// }

		const unsub = add_subscription(this.struct.supabase, {
			struct: this.struct,
			filter: realtime as any
			// callback: (payload) => {

			// }
		});

		return () => {
			void unsub;
		};
	}

	/**
	 * Promise-like interface resolving to full query results.
	 *
	 * @param {(value: Result<SupaStructData<Schema, RowName, Required>[]>) => void} [onfulfilled] - Success callback.
	 * @param {(reason: any) => void} [onrejected] - Failure callback.
	 * @returns {ReturnType<SupaQuery<Schema, RowName, Required, HasDefault>['fetch_all']>} Query result promise wrapper.
	 */
	then(
		onfulfilled?: (value: Result<SupaStructData<Schema, RowName, Required>[]>) => void,
		onrejected?: (reason: any) => void
	) {
		const res = this.fetch_all();
		res.then(onfulfilled).catch(onrejected);
		return res;
	}

	/**
	 * Sets a default row returned by `single` when query has no match.
	 *
	 * @param {SupaStructData<Schema, RowName, Required>} data - Default fallback row.
	 * @returns {SupaQuery<Schema, RowName, Required, true>} Query instance with default marker.
	 */
	default(data: SupaStructData<Schema, RowName, Required>) {
		this._default = data;
		return this as SupaQuery<Schema, RowName, Required, true>;
	}

	/**
	 * Fetches all rows and unwraps the `Result`.
	 *
	 * @returns {SupaStructData<Schema, RowName, Required>[]} Unwrapped rows.
	 */
	unwrap() {
		return this.fetch_all().unwrap();
	}

	/**
	 * Fetches all rows and returns fallback on failure.
	 *
	 * @param {SupaStructData<Schema, RowName, Required>[]} defaultValue - Fallback rows.
	 * @returns {SupaStructData<Schema, RowName, Required>[]} Query rows or fallback.
	 */
	unwrapOr(defaultValue: SupaStructData<Schema, RowName, Required>[]) {
		return this.fetch_all().unwrapOr(defaultValue);
	}
}

/**
 * Configuration accepted by `JoinQuery` for left/right projection and join matching behavior.
 */
type JoinConfig<
	Schema extends RowSchemaName,
	RowName extends RowTableNames<Schema>,
	OtherSchema extends RowSchemaName,
	OtherRowName extends RowTableNames<OtherSchema>,
	RequiredA extends keyof RowWithoutArchived<Schema, RowName>,
	RequiredB extends keyof RowWithoutArchived<OtherSchema, OtherRowName>
> = {
	requiredA?: readonly RequiredA[];
	whereB?: Partial<RowWithoutArchived<OtherSchema, OtherRowName>>;
	joinOn?: {
		left: keyof RowWithoutArchived<Schema, RowName>;
		right: keyof RowWithoutArchived<OtherSchema, OtherRowName>;
	};
} & ({ pullB?: true; requiredB?: readonly RequiredB[] } | { pullB: false; requiredB?: never });

/**
 * Join-focused query wrapper for `SupaStruct.join()`.
 *
 * This class performs relation-aware hydration for left-table rows while optionally
 * projecting right-table rows, and supports fetch/pagination/count/sync utilities.
 */
class JoinQuery<
	Schema extends RowSchemaName,
	RowName extends RowTableNames<Schema>,
	OtherSchema extends RowSchemaName,
	OtherRowName extends RowTableNames<OtherSchema>,
	RequiredA extends keyof RowWithoutArchived<Schema, RowName> = keyof RowWithoutArchived<
		Schema,
		RowName
	>,
	RequiredB extends keyof RowWithoutArchived<OtherSchema, OtherRowName> = keyof RowWithoutArchived<
		OtherSchema,
		OtherRowName
	>,
	HasDefault extends boolean = false
> {
	private _default: SupaStructData<Schema, RowName, RequiredA | 'id'> | null = null;
	private _sort: (
		a: SupaStructData<Schema, RowName, RequiredA | 'id'>,
		b: SupaStructData<Schema, RowName, RequiredA | 'id'>
	) => number = $state((a, b) =>
		String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0
	);
	private _reverse = $state(false);
	private readonly matchedLeftIds = $state(new SvelteSet<string>());

	/**
	 * Creates a join query wrapper between two structs.
	 *
	 * @param {SupaStruct<Schema, RowName>} struct - Left-side struct.
	 * @param {SupaStruct<OtherSchema, OtherRowName>} other - Right-side struct.
	 * @param {JoinConfig<Schema, RowName, OtherSchema, OtherRowName, RequiredA, RequiredB>} [config] - Join behavior configuration.
	 */
	constructor(
		public readonly struct: SupaStruct<Schema, RowName>,
		public readonly other: SupaStruct<OtherSchema, OtherRowName>,
		public readonly config?: JoinConfig<
			Schema,
			RowName,
			OtherSchema,
			OtherRowName,
			RequiredA,
			RequiredB
		>
	) {}

	/**
	 * Normalized required field list for left table projection.
	 */
	private get leftRequired() {
		const required = (this.struct as any).getEffectiveRequiredFields(
			this.config?.requiredA
		) as readonly (RequiredA | 'id')[];
		return Array.from(new SvelteSet([...required.map(String), 'id'])) as readonly (
			RequiredA | 'id'
		)[];
	}

	/**
	 * Normalized required field list for right table projection.
	 */
	private get rightRequired() {
		const required = (this.other as any).getEffectiveRequiredFields(
			this.config?.pullB === false ? undefined : this.config?.requiredB
		) as readonly (RequiredB | 'id')[];
		const fields = Array.from(new SvelteSet([...required.map(String), 'id']));
		for (const key of Object.keys(this.config?.whereB ?? {}))
			if (!fields.includes(key)) fields.push(key);
		return fields as readonly (RequiredB | 'id')[];
	}

	/**
	 * Resolves join key mapping from explicit config or known conventions.
	 */
	private getJoinFields() {
		if (this.config?.joinOn) {
			return { left: String(this.config.joinOn.left), right: String(this.config.joinOn.right) };
		}
		const leftKeys = new SvelteSet((this.struct as any).getSchemaRowKeys().map(String));
		const rightKeys = new SvelteSet((this.other as any).getSchemaRowKeys().map(String));
		for (const candidate of [
			{ left: 'id', right: `${String(this.struct.table)}_id` },
			{ left: 'id', right: `${String(this.struct.table)}Id` },
			{ left: 'number', right: `${String(this.struct.table)}_number` },
			{ left: 'number', right: `${String(this.struct.table)}Number` },
			{ left: 'number', right: 'team_number' },
			{ left: 'id', right: 'id' }
		]) {
			if (leftKeys.has(candidate.left) && rightKeys.has(candidate.right)) return candidate;
		}
		return null;
	}

	/**
	 * Deduplicates rows by id.
	 */
	private uniqueById<T extends { id?: string }>(rows: T[]) {
		const byId = new SvelteMap<string, T>();
		for (const row of rows) if (row?.id) byId.set(String(row.id), row);
		return Array.from(byId.values());
	}

	/**
	 * Hydrates left/right join rows and updates tracked matched-left ids.
	 */
	private hydrateJoin(
		leftRows: PartialRow<Schema, RowName, RequiredA | 'id'>[],
		rightRows: PartialRow<OtherSchema, OtherRowName, RequiredB | 'id'>[]
	) {
		this.matchedLeftIds.clear();
		for (const row of leftRows) this.matchedLeftIds.add(String(row.id));
		const left = this.struct.Hydrate(
			leftRows,
			this.leftRequired as readonly RequiredA[]
		) as SupaStructData<Schema, RowName, RequiredA | 'id'>[];
		const right =
			this.config?.pullB === false
				? []
				: (this.other.Hydrate(
						rightRows,
						this.rightRequired as readonly RequiredB[]
					) as SupaStructData<OtherSchema, OtherRowName, RequiredB | 'id'>[]);
		return { left, right };
	}

	/**
	 * Attempts join hydration from Dexie-backed local data first.
	 */
	private async pull_dexie() {
		const dexieA = this.struct.getDexie(this.struct.getSchemaDefinition().Row as any);
		const dexieB = this.other.getDexie(this.other.getSchemaDefinition().Row as any);
		if (!dexieA || !dexieB) {
			this.matchedLeftIds.clear();
			return [] as SupaStructData<Schema, RowName, RequiredA | 'id'>[];
		}

		const rightResult = await dexieB.get((this.config?.whereB ?? {}) as any);
		if (rightResult.isErr() || !rightResult.value.length) {
			this.matchedLeftIds.clear();
			return [] as SupaStructData<Schema, RowName, RequiredA | 'id'>[];
		}
		const rightRows = rightResult.value.map((row) => row.raw) as PartialRow<
			OtherSchema,
			OtherRowName,
			RequiredB | 'id'
		>[];
		if (this.config?.pullB !== false)
			this.other.Hydrate(rightRows, this.rightRequired as readonly RequiredB[]);

		const joinFields = this.getJoinFields();
		if (!joinFields) {
			this.matchedLeftIds.clear();
			return [] as SupaStructData<Schema, RowName, RequiredA | 'id'>[];
		}

		const leftAll = await dexieA.all();
		if (leftAll.isErr()) {
			this.matchedLeftIds.clear();
			return [] as SupaStructData<Schema, RowName, RequiredA | 'id'>[];
		}

		const rightJoinValues = new SvelteSet(
			rightRows
				.map((row) => {
					const value = (row as any)[joinFields.right];
					return value === undefined || value === null ? null : String(value);
				})
				.filter((value): value is string => value !== null)
		);
		const leftRows = leftAll.value
			.map((item) => item.raw as PartialRow<Schema, RowName, RequiredA | 'id'>)
			.filter((row) => {
				const value = (row as any)[joinFields.left];
				return value !== undefined && value !== null && rightJoinValues.has(String(value));
			});

		return this.hydrateJoin(this.uniqueById(leftRows), this.uniqueById(rightRows)).left;
	}

	/**
	 * Builds the Supabase join query for current join configuration.
	 */
	private build(count?: 'exact' | 'estimated' | 'planned') {
		const leftFields = Array.from(
			new SvelteSet([...this.leftRequired.map(String), 'id', 'archived'])
		);
		const rightFields = Array.from(
			new SvelteSet([...this.rightRequired.map(String), 'id', 'archived'])
		);
		let query = this.struct.supabase
			.schema(this.struct.schema)
			.from(this.struct.table)
			.select(
				`${leftFields.join(',')}, ${String(this.other.table)}!inner(${rightFields.join(',')})`,
				{ count }
			)
			.filter('archived', 'eq', false)
			.filter(`${String(this.other.table)}.archived`, 'eq', false);
		for (const [key, value] of Object.entries(this.config?.whereB ?? {})) {
			query = query.filter(`${String(this.other.table)}.${key}`, 'eq', value as any);
		}
		return query;
	}

	/**
	 * Reactive left-table rows currently matched by this join.
	 */
	get reactive() {
		const rows = Array.from(this.struct.cache.values()).filter((item) =>
			this.matchedLeftIds.has(String(item.id))
		);
		return rows.sort((a, b) => (this._reverse ? -1 : 1) * this._sort(a as any, b as any));
	}

	/**
	 * First matched row or default fallback.
	 */
	get single(): HasDefault extends true
		? SupaStructData<Schema, RowName, RequiredA>
		: SupaStructData<Schema, RowName, RequiredA> | null {
		const [first] = this.reactive;
		if (first) return first as any;
		if (this._default) return this._default as any;
		return null as any;
	}

	/**
	 * Pagination facade for join queries.
	 */
	get paginated() {
		return {
			page: async (page: number, size: number) => {
				const res = await this.fetch_paginated(page, size);
				if (res.isErr()) throw res.error;
				return res.value;
			}
		};
	}

	/**
	 * Sets sort comparator for matched rows.
	 */
	sort(
		sort: (
			a: SupaStructData<Schema, RowName, RequiredA | 'id'>,
			b: SupaStructData<Schema, RowName, RequiredA | 'id'>
		) => number
	) {
		this._sort = sort;
		return this;
	}
	/**
	 * Toggles reverse sort ordering.
	 */
	reverse() {
		this._reverse = !this._reverse;
		return this;
	}

	/**
	 * Fetches all matched left-table rows for this join.
	 */
	fetch_all() {
		return attemptAsync(async () => {
			await this.pull_dexie();
			const res = await this.build();
			if (res.error) throw res.error;
			const leftRows: PartialRow<Schema, RowName, RequiredA | 'id'>[] = [];
			const rightRows: PartialRow<OtherSchema, OtherRowName, RequiredB | 'id'>[] = [];
			for (const item of (res.data ?? []) as unknown as Array<Record<string, unknown>>) {
				const nested = item[String(this.other.table)];
				const { [String(this.other.table)]: _nested, ...leftOnly } = item;
				const rightCandidates = Array.isArray(nested) ? nested : nested ? [nested] : [];
				if (!rightCandidates.length) continue;
				leftRows.push(leftOnly as PartialRow<Schema, RowName, RequiredA | 'id'>);
				for (const candidate of rightCandidates)
					if (
						candidate &&
						typeof candidate === 'object' &&
						(candidate as { archived?: boolean }).archived !== true
					)
						rightRows.push(candidate as PartialRow<OtherSchema, OtherRowName, RequiredB | 'id'>);
			}
			return this.hydrateJoin(this.uniqueById(leftRows), this.uniqueById(rightRows)).left;
		});
	}

	/**
	 * Fetches a page of join-matched rows from Supabase.
	 */
	fetch_paginated(page: number, size: number) {
		return attemptAsync(async () => {
			await this.pull_dexie();
			const from = (page - 1) * size;
			const to = from + size - 1;
			const res = await this.build('exact').range(from, to);
			if (res.error) throw res.error;
			const leftRows: PartialRow<Schema, RowName, RequiredA | 'id'>[] = [];
			const rightRows: PartialRow<OtherSchema, OtherRowName, RequiredB | 'id'>[] = [];
			for (const item of (res.data ?? []) as unknown as Array<Record<string, unknown>>) {
				const nested = item[String(this.other.table)];
				const { [String(this.other.table)]: _nested, ...leftOnly } = item;
				const rightCandidates = Array.isArray(nested) ? nested : nested ? [nested] : [];
				if (!rightCandidates.length) continue;
				leftRows.push(leftOnly as PartialRow<Schema, RowName, RequiredA | 'id'>);
				for (const candidate of rightCandidates)
					if (
						candidate &&
						typeof candidate === 'object' &&
						(candidate as { archived?: boolean }).archived !== true
					)
						rightRows.push(candidate as PartialRow<OtherSchema, OtherRowName, RequiredB | 'id'>);
			}
			const hydrated = this.hydrateJoin(this.uniqueById(leftRows), this.uniqueById(rightRows)).left;
			return { data: hydrated, count: res.count ?? hydrated.length };
		});
	}

	/**
	 * Counts matched join rows.
	 */
	count() {
		return attemptAsync(async () => {
			const res = await this.build('exact').limit(0);
			if (res.error) throw res.error;
			return res.count ?? 0;
		});
	}
	/**
	 * Fetches first or last matched join row.
	 */
	fetch_single(type: 'first' | 'last') {
		return attemptAsync(async () => {
			const rows = await this.fetch_all();
			if (rows.isErr()) throw rows.error;
			return type === 'first' ? (rows.value[0] ?? null) : (rows.value.at(-1) ?? null);
		});
	}
	/**
	 * Convenience first-row helper.
	 */
	first() {
		return this.fetch_single('first');
	}
	/**
	 * Convenience last-row helper.
	 */
	last() {
		return this.fetch_single('last');
	}
	/**
	 * Syncs join result with query cache and TTL semantics.
	 */
	sync(ttl: number) {
		return this.pull_dexie().then(async () => {
			if (!browser) return this.fetch_all();
			const query_key = stable_stringify({
				schema: this.struct.schema,
				table: this.struct.table,
				other: this.other.table,
				config: {
					requiredA: this.config?.requiredA?.map(String),
					requiredB:
						this.config?.requiredB === undefined ? undefined : this.config.requiredB.map(String),
					whereB: this.config?.whereB,
					joinOn: this.config?.joinOn,
					pullB: this.config?.pullB ?? true
				}
			});
			const cache_row_id = `${this.struct.schema}:${this.struct.table}:${query_key}`;
			const cached = await QueryCache.get({
				query: query_key,
				schema: this.struct.schema,
				table: this.struct.table
			}).first();
			if (cached.isOk() && cached.value) {
				if (cached.value.raw.version !== QUERY_CACHE_VERSION) await cached.value.delete();
				else if (Date.now() - cached.value.raw.last_sync <= ttl) return this.reactive;
			}
			const hydrated = await this.fetch_all().unwrap();
			await QueryCache.upsert({
				query: query_key,
				schema: this.struct.schema,
				table: this.struct.table,
				version: QUERY_CACHE_VERSION,
				required: this.leftRequired.map(String).join(','),
				last_sync: Date.now(),
				created_at: new SvelteDate(),
				id: cache_row_id
			});
			return hydrated;
		});
	}

	/**
	 * Registers realtime updates for left-table rows in this join.
	 */
	subscribe(
		callback?: (
			data: SupaStructData<Schema, RowName, RequiredA>,
			event: 'UPDATE' | 'INSERT' | 'DELETE'
		) => void
	) {
		if (!callback) return () => {};
		const unsub = add_subscription(this.struct.supabase, {
			struct: this.struct,
			filter: '*',
			callback: (payload) => {
				const raw = payload.new as any;
				if (!raw) return;
				const row = this.struct.Generator(raw as any, {
					required: this.leftRequired as any
				}) as SupaStructData<Schema, RowName, RequiredA>;
				if (this.matchedLeftIds.has(String(row.id))) callback(row, 'INSERT');
			}
		});
		return () => {
			void unsub;
		};
	}

	/**
	 * Promise-like interface resolving to full join results.
	 */
	then(
		onfulfilled?: (value: Result<SupaStructData<Schema, RowName, RequiredA | 'id'>[]>) => void,
		onrejected?: (reason: any) => void
	) {
		const res = this.fetch_all();
		res.then(onfulfilled).catch(onrejected);
		return res;
	}
	/**
	 * Sets default fallback row for `single`.
	 */
	default(data: SupaStructData<Schema, RowName, RequiredA | 'id'>) {
		this._default = data;
		return this as JoinQuery<
			Schema,
			RowName,
			OtherSchema,
			OtherRowName,
			RequiredA,
			RequiredB,
			true
		>;
	}
	/**
	 * Fetches and unwraps all join results.
	 */
	unwrap() {
		return this.fetch_all().unwrap();
	}
	/**
	 * Fetches join results with fallback on failure.
	 */
	unwrapOr(defaultValue: SupaStructData<Schema, RowName, RequiredA | 'id'>[]) {
		return this.fetch_all().unwrapOr(defaultValue);
	}
}

/**
 * Pagination controller bound to a query result.
 *
 * This helper tracks current page state and keeps stable row ids for page slices
 * so cache updates do not break displayed pagination lists.
 */
class _SupaPagination<
	Schema extends RowSchemaName,
	RowName extends RowTableNames<Schema>,
	Required extends keyof RowWithoutArchived<Schema, RowName> = keyof RowWithoutArchived<
		Schema,
		RowName
	>
> {
	/**
	 * Current one-based page number.
	 */
	private _currentPage = $state(1);
	/**
	 * Number of rows requested per page.
	 */
	private _pageSize = $state(10);
	/**
	 * Total number of rows matching the current query.
	 */
	private _totalItems = $state(0);

	/**
	 * Exact row IDs for the active page view, used to avoid stale cache-slice mismatches.
	 */
	private _currentPageIds = $state<string[]>([]);

	/**
	 * Creates a pagination controller bound to a parent struct and query.
	 *
	 * @param {SupaStruct<Schema, RowName>} struct - Owning struct.
	 * @param {(page: number, size: number) => Promise<PaginatedResponse<SupaStructData<Schema, RowName, Required>>>} paginateQuery - Pagination callback.
	 * @example
	 * const pager = new _SupaPagination(struct, paginateFn);
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

/**
 * Typed table adapter for a schema/table pair.
 *
 * A `SupaStructData` wraps raw row data with convenience mutation helpers and
 * keeps object identity stable across cache refreshes.
 *
 * @example
 * const profile = await users.fromId('abc123');
 * await profile.update({ display_name: 'Ada' });
 */
export class SupaStructData<
	Schema extends RowSchemaName,
	RowName extends RowTableNames<Schema>,
	Required extends keyof RowWithoutArchived<Schema, RowName> = keyof RowWithoutArchived<
		Schema,
		RowName
	>,
	UpdateName extends UpdateTableNames<Schema> = Extract<RowName, UpdateTableNames<Schema>>
> {
	/**
	 * Raw row payload backing this wrapper.
	 *
	 * This value is reactive and updated in place as row fields change.
	 */
	public readonly raw: PartialRow<Schema, RowName, Required> = $state({} as any);

	/**
	 * Creates a wrapped row instance tied to a parent struct.
	 *
	 * @param {SupaStruct<Schema, RowName>} struct - Parent struct.
	 * @param {PartialRow<Schema, RowName, Required>} data - Initial row data.
	 * @param {{ is_temporary?: boolean }} [config] - Optional local-only metadata.
	 * @example
	 * const item = new SupaStructData(struct, row);
	 */
	constructor(
		/**
		 * Parent struct that owns this row wrapper and its cache.
		 */
		public readonly struct: SupaStruct<Schema, RowName>,
		data: PartialRow<Schema, RowName, Required>,
		/**
		 * Optional wrapper metadata, including whether this row is a local temporary draft.
		 */
		public readonly config?: { is_temporary?: boolean }
	) {
		this.raw = data;
	}
	/**
	 * Row identifier convenience accessor.
	 *
	 * @returns {string} Row id.
	 */
	get id() {
		return this.raw.id;
	}

	/**
	 * Indicates whether this row is a temporary local placeholder.
	 *
	 * @returns {boolean} True when the row is a transient draft.
	 */
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

	/**
	 * Removes the current row from the local cache and Dexie store without touching the server.
	 *
	 * @returns {Promise<Result<void, SupaError>>} Local deletion result.
	 */
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
