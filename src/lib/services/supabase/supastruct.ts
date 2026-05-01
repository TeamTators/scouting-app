/* eslint-disable @typescript-eslint/no-explicit-any */
// import supabase from "$lib/services/supabase";
import { attempt, attemptAsync, ComplexEventEmitter, ResultPromise, type Result } from 'ts-utils';
import { WritableArray, WritableBase } from '../writables';
import {
	REALTIME_SUBSCRIBE_STATES,
	RealtimeChannel,
	type SupabaseClient
} from '@supabase/supabase-js';
import { schemas } from '$lib/types/supabase-zod';
import { z } from 'zod';
import { browser } from '$app/environment';
import { SupaStructData } from './supastruct-data';
import { SupaPagination } from './supa-pagination';
import { SupaCache } from './supacache';
import { type Database, type DatabasePivoted, type SchemaName } from '$lib/types/supabase';

export type Client = SupabaseClient<Database>;

// Yes, I need to do this to pivot the generated types into a shape that makes it easy to extract row types by table name in the SupaStruct class. No, I don't like it.
// Hush
// Although if you have a better idea, I'm open to it.
export type RowSchemaName = keyof DatabasePivoted['Row'];
export type InsertSchemaName = keyof DatabasePivoted['Insert'];
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
> = DatabasePivoted['Row'][Schema][Name];
export type Insert<
	Schema extends SchemaName,
	Name extends InsertTableNames<Schema>
> = DatabasePivoted['Insert'][Schema][Name];
export type Update<
	Schema extends SchemaName,
	Name extends UpdateTableNames<Schema>
> = DatabasePivoted['Update'][Schema][Name];

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
 * Partial row shape for patch operations, filters, and loose cache payloads.
 *
 * @template Name - Table name from {@link TableNames}.
 */
export type PartialRow<Schema extends SchemaName, Name extends RowTableNames<Schema>> = Partial<
	Row<Schema, Name>
>;

/**
 * Writable status container for async operations.
 *
 * @typeParam T - Success payload type when operation completes.
 */
export class SupaStatus<T> extends WritableBase<
	| {
			pending: true;
	  }
	| {
			pending: false;
			result: T;
	  }
	| {
			pending: false;
			error: Error;
	  }
> {
	/**
	 * Creates a pending async status container.
	 *
	 * @example
	 * const status = new SupaStatus<string[]>();
	 * status.set({ pending: false, result: ['ok'] });
	 */
	constructor() {
		super({
			pending: true
		});
	}
}

/**
 * Runtime configuration for a {@link SupaStruct} instance.
 *
 * @template Name - Table name handled by the struct.
 * @property name - Table name in the active schema.
 * @property client - Typed Supabase client.
 * @property versionHistory - Reserved flag for historical row tracking.
 * @property debug - Enables scoped console logging for this struct.
 * @property subscribe - Reserved flag for opt-in realtime behavior.
 */
export type SupaConfig<Schema extends RowSchemaName, Name extends RowTableNames<Schema>> = {
	table: Name;
	client: Client;
	schema: Schema;
	versionHistory?: boolean;
	debug?: boolean;
	subscribe?: boolean;
};

/**
 * Read mode discriminator used by `ReadConfig` and overload signatures.
 */
export type ReadType = 'paginated' | 'all' | 'single' | 'count';

/**
 * Union of possible return types for table read operations.
 *
 * - `all` returns a live writable array.
 * - `single` returns an async `ResultPromise`.
 */
export type ReadReturnType<Schema extends RowSchemaName, RowName extends RowTableNames<Schema>> =
	| SupaStructArray<Schema, RowName>
	| SupaPagination<Schema, RowName>
	| ResultPromise<SupaStructData<Schema, RowName> | null>
	| ResultPromise<number>;

/**
 * Configuration object for read operations.
 *
 * @template T - Read mode discriminator.
 * @property type - Requested result mode.
 * @property expires - Absolute expiry used for browser-side cache persistence.
 * @property archived - Optional flag to include archived rows in the result (if supported by the struct).
 *
 * @example
 * const config: ReadConfig<'single'> = {
 *   type: 'single',
 *   expires: new Date(Date.now() + 5 * 60 * 1000)
 * };
 */
export type ReadConfig<T extends ReadType> = {
	type: T;
	expires?: Date;
	includeArchived?: boolean;
} & (T extends 'all'
	? {}
	: T extends 'paginated'
		? {
				limit: number;
				page: number;
			}
		: T extends 'single'
			? {}
			: T extends 'count'
				? {}
				: never);

/**
 * Typed data access facade for one Supabase table.
 *
 * Responsibilities:
 * - Validate payloads against generated zod schemas.
 * - Expose reactive arrays for list reads.
 * - Expose `ResultPromise` APIs for async single reads.
 * - Keep registered arrays synchronized with realtime updates.
 * - Persist cached responses in browser storage through `SupaCache`.
 *
 * @template RowName - Table name this struct instance represents.
 */
export class SupaStruct<
	Schema extends RowSchemaName,
	RowName extends RowTableNames<Schema>,
	InsertName extends InsertTableNames<Schema> = Extract<RowName, InsertTableNames<Schema>>
> {
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
		// const existing = SupaStruct.structs.get(config.name);
		// if (existing) return existing as unknown as SupaStruct<Name>;
		return new SupaStruct(config);
	}

	private readonly cache = new Map<string, SupaStructData<Schema, RowName>>();
	private readonly em = new ComplexEventEmitter<{
		new: [SupaStructData<Schema, RowName>];
		update: [SupaStructData<Schema, RowName>, SupaStructData<Schema, RowName>['_data']];
		delete: [SupaStructData<Schema, RowName>];
		archive: [SupaStructData<Schema, RowName>];
		restore: [SupaStructData<Schema, RowName>];
		realtime: [REALTIME_SUBSCRIBE_STATES];
	}>();

	/**
	 * Subscribes to struct-level events.
	 *
	 * @example
	 * users.on('new', (row) => {
	 *   console.log('new row', row.data.id);
	 * });
	 */
	public readonly on = this.em.on.bind(this.em);
	/**
	 * Unsubscribes a previously registered event handler.
	 */
	public readonly off = this.em.off.bind(this.em);
	/**
	 * Subscribes to an event once, then auto-unsubscribes.
	 */
	public readonly once = this.em.once.bind(this.em);
	/** Internal emitter entrypoint used by this class only. */
	private readonly emit = this.em.emit.bind(this.em);

	/** Realtime channel dedicated to this table instance. */
	private readonly channel: RealtimeChannel;

	/**
	 * Creates a table helper bound to a single table name.
	 *
	 * @param config - Table and client configuration.
	 */
	constructor(public readonly config: SupaConfig<Schema, RowName>) {
		this.channel = this.supabase.channel(`struct.${this.schema}.${this.table}`);
		// SupaStruct.structs.set(this.config.name, this as any);
		this.log(`Initialized struct for schema ${this.schema} table ${this.table}`);
		if (!Object.keys(schemas).includes(this.schema)) {
			throw new Error(
				`Schema ${this.schema} not found in generated types. Please ensure your Supabase schema is correctly represented in your zod definitions.`
			);
		}

		if (!Object.keys((schemas as any)[this.schema]).includes(this.table)) {
			throw new Error(
				`Table ${this.table} not found in generated types for schema ${this.schema}. Please ensure your table is correctly represented in your zod definitions.`
			);
		}
	}

	/**
	 * Table name this struct is bound to.
	 *
	 * @returns Table name from generated DB types.
	 */
	get table() {
		return String(this.config.table) as Extract<RowName, string>;
	}

	/**
	 * Active schema name inferred from the typed client.
	 */
	get schema() {
		return this.config.schema;
	}

	/**
	 * Typed Supabase client used by this struct.
	 *
	 * @returns Shared client from config.
	 */
	get supabase() {
		return this.config.client;
	}

	private log(...args: unknown[]) {
		if (this.config.debug) {
			console.log(`[SupaStruct ${this.table}]`, ...args);
		}
	}

	/** Guards realtime listener setup from duplicate initialization. */
	private listening = false;

	/**
	 * Sets up realtime table listeners once per instance.
	 *
	 * On incoming changes, registered arrays are updated in-place to keep UI state fresh.
	 *
	 * @returns `true` when listeners were created; `false` when listeners already existed.
	 */
	setupListeners() {
		if (this.listening) return false;
		this.listening = true;

		this.log('Setting up listeners for realtime updates');

		this.channel
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: String(this.schema),
					table: this.table
				},
				(payload) => {
					this.log('Received event payload:', payload);
					let data = this.Generator({});
					switch (payload.eventType) {
						case 'INSERT':
							data = this.Generator(payload.new);
							this.log('Received new data:', data);
							this.emit('new', data);
							break;
						case 'UPDATE':
							data = this.Generator(payload.new);
							this.log('Received updated data:', data);
							this.emit('update', data, payload.old as any);
							break;
						case 'DELETE':
							data = this.Generator(payload.old);
							this.log('Received deleted data:', data);
							this.emit('delete', data);
							break;
					}

					if ('archived' in payload.new && 'archived' in payload.old) {
						if (payload.new.archived && !payload.old.archived) {
							this.log('Received archived data:', data);
							this.emit('archive', data);
						} else if (!payload.new.archived && payload.old.archived) {
							this.log('Received restored data:', data);
							this.emit('restore', data);
						}
					}

					for (const { array, satisfies } of this.registeredArrays.values()) {
						const has = array.data.find(
							(item) => String((item.data as any).id) === String((data.data as any).id)
						);
						if (satisfies(data.data)) {
							if (!has) {
								array.push(data);
							}
						} else {
							if (has) {
								array.splice(array.data.indexOf(has), 1);
							}
						}
					}
				}
			)
			.subscribe((status, error) => {
				this.log(`Subscription status for channel ${this.table}:`, status);
				if (error) {
					this.log(`Subscription error for channel ${this.table}:`, error);
				}
				this.emit('realtime', status);
			});
		return true;
	}

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
	 * Type-only sample accessor used to infer `SupaStructData<Name>` in generic contexts.
	 *
	 * @throws Always throws at runtime.
	 */
	get sample(): SupaStructData<Schema, RowName> {
		throw new Error('Sample should never be used at runtime');
	}

	private readonly registeredArrays = new Map<
		string,
		{
			array: SupaStructArray<Schema, RowName>;
			satisfies: (data: PartialRow<Schema, RowName>) => boolean;
		}
	>();

	/**
	 * Unsubscribes the table realtime channel.
	 *
	 * @param timeout - Optional unsubscribe timeout.
	 * @returns `Result` wrapping unsubscribe status.
	 */
	private unsub(timeout?: number) {
		return attempt(() => this.channel.unsubscribe(timeout));
	}

	/**
	 * Subscribes the table realtime channel.
	 *
	 * @param fn - Optional callback receiving subscribe status updates.
	 * @returns `Result` wrapping subscribe status.
	 */
	private sub(fn?: (status: string) => void) {
		return attempt(() =>
			this.channel.subscribe((status) => {
				fn?.(status);
				this.emit('realtime', status);
			})
		);
	}

	/**
	 * Registers a reactive array so realtime events can keep it synchronized.
	 *
	 * @param name - Unique registration key.
	 * @param array - Reactive destination array.
	 * @param satisfies - Predicate to determine whether an incoming row belongs in the array.
	 */
	registerArray(
		name: string,
		array: SupaStructArray<Schema, RowName>,
		satisfies: (data: PartialRow<Schema, RowName>) => boolean
	) {
		if (browser) {
			this.log(`Registering array ${name} with realtime listeners`);
			this.registeredArrays.set(name, {
				array,
				satisfies
			});
			array.once('subscribe', () => {
				const listened = this.setupListeners();
				if (listened) {
					const res = this.sub((status) => {
						this.log(`Subscription status for array ${name}:`, status);
					});
					if (res.isErr()) {
						this.log(`Error subscribing to channel for array ${name}:`, res.error);
					}
				}
			});
			array.once('all-unsubscribe', () => {
				for (const item of this.registeredArrays.values()) {
					// if any array is still subscribe, don't unsubscribe from the channel
					if (item.array.subscribers.size > 0) return;
				}
				this.unsub();
			});
		}
	}

	/**
	 * Converts unknown input into a typed `SupaStructData` wrapper.
	 *
	 * Uses schema validation and browser-side instance memoization to keep object identity stable.
	 *
	 * @param row - Raw row-like object.
	 * @returns Typed row wrapper instance.
	 */
	Generator(row: unknown) {
		const validated = this.validate(row);
		if (browser) {
			const has = this.cache.get(String(validated.id));
			if (has) {
				has['_data'] = {
					...has.data,
					...validated
				};
				return has;
			}
		}
		const data = new SupaStructData(this, validated as PartialRow<Schema, RowName>);
		if (browser) this.cache.set(String(validated.id), data);
		return data;
	}

	/**
	 * Validates input against the generated zod row schema for this table.
	 *
	 * @param data - Unknown payload to validate.
	 * @returns Parsed row-like object (`Row.partial()`).
	 * @throws If the table schema is missing or parsing fails.
	 */
	validate(data: unknown) {
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
		const parseResult = schema.Row.partial().safeParse(data);
		if (!parseResult.success) {
			throw new Error(
				`Failed to validate data for table ${this.table}: ` + parseResult.error.message
			);
		}
		return parseResult.data;
	}

	// TODO: Integrate pagination and count into
	/**
	 * Reads all rows and returns a reactive array.
	 *
	 * @param config - Read configuration with cache expiry.
	 * @returns Writable array that is hydrated asynchronously.
	 *
	 * @example
	 * const users = usersStruct.all({
	 *   type: 'all',
	 *   expires: new Date(Date.now() + 60000)
	 * });
	 */
	all(config: ReadConfig<'all'>): SupaStructArray<Schema, RowName>;
	// all(config: ReadConfig<'paginated'>): SupaPagination<Name>;
	/**
	 * Reads first available row as a `ResultPromise`.
	 *
	 * @param config - Read configuration with cache expiry.
	 * @returns Async result resolving to first row or `null`.
	 */
	all(config: ReadConfig<'single'>): ResultPromise<SupaStructData<Schema, RowName> | null>;
	// all(config: ReadConfig<'count'>): ResultPromise<number>;
	/**
	 * Reads rows using cache-first behavior in the browser.
	 *
	 * @param config - Read mode and cache metadata.
	 * @returns Overloaded by `config.type`.
	 */
	all(config: ReadConfig<ReadType>): ReadReturnType<Schema, RowName> {
		const has = this.registeredArrays.get('all');
		if (has) return has.array;

		const get = async () => {
			if (browser) {
				const cache = await SupaCache.get(
					{ table: this.table, key: 'all' },
					{
						pagination: false
					}
				);

				if (cache.isOk()) {
					const [cached] = cache.value.data;
					if (cached) {
						if (new Date() >= cached.data.expires) {
							cached.delete();
						} else {
							this.log('Using cached data for all query:', cached.data.value);
							return cached.data.value.map((i) => this.Generator(i));
						}
					}
				}
			}

			let query = this.supabase
				.schema(this.schema)
				.from(this.table)
				.select('*') //,
				.filter('archived', 'eq', config.includeArchived ?? false);
			

			if (config.includeArchived !== true) {
				query = query.filter('archived', 'eq', false);
			}

			const transaction = await query;

			const res = this.runTransaction(
				{
					data: transaction.data as any,
					error: transaction.error
				},
				'array'
			);
			if (res.isErr()) {
				this.log('Error fetching all data:', res.error);
				return [];
			}

			if (browser && config.expires && res.value.length) {
				SupaCache.new({
					table: this.table,
					key: 'all',
					value: res.value,
					expires: config.expires
				});
			}

			return res.value;
		};

		if (config.type === 'single') {
			return attemptAsync(async () => {
				const [res] = await get();
				if (res) return this.Generator(res);
				return null;
			});
		}

		const arr = this.arr();
		get().then((data) => {
			arr.set(data.map((item) => this.Generator(item)));
		});
		this.registerArray('all', arr, (data) => (data as { archived?: boolean }).archived === false);
		return arr;
	}

	/**
	 * Inserts one or more rows.
	 *
	 * @param data - Insert payloads.
	 * @returns Async status writable containing inserted row wrappers on success.
	 *
	 * @example
	 * const status = usersStruct.new({ email: 'a@b.com' } as Insert<'users'>);
	 */
	new(...data: Insert<Schema, InsertName>[]) {
		this.log('Creating new data with input:', data);
		const status = new SupaStatus<SupaStructData<Schema, RowName>[]>();

		const schemaGroup = schemas[this.schema];
		if (!schemaGroup) {
			this.log(`No schema found for ${this.schema} in generated types`);
			status.set({
				pending: false,
				error: new Error(`No schema found for ${this.schema} in generated types`)
			});
			return status;
		}

		const table = this.table;

		if (table in schemaGroup === false) {
			this.log(`No table ${table} found in schema ${this.schema} of generated types`);
			status.set({
				pending: false,
				error: new Error(`No table ${table} found in schema ${this.schema} of generated types`)
			});
			return status;
		}

		const schemaFound = (schemaGroup as any)[table]?.Insert;
		if (!schemaFound) {
			this.log(`No Insert schema found for table ${table} in schema ${this.schema}`);
			status.set({
				pending: false,
				error: new Error(`Insert schema not found for table ${table}`)
			});
			return status;
		}

		const parsed = z.array(schemaFound).safeParse(data);
		if (parsed.success === false) {
			this.log(`Error validating new data for table ${this.table}:`, parsed.error);
			status.set({
				pending: false,
				error: new Error(`Invalid data for table ${this.table}: ` + parsed.error.message)
			});
			return status;
		}
		this.log('Validated new data:', parsed.data);
		this.supabase
			.schema(this.schema)
			.from(this.table)
			.insert(data as any)
			.select('*')
			.then((res) => {
				this.log('Received response for new data:', res);
				const transactionResult = this.runTransaction(
					{
						data: res.data as any,
						error: res.error
					},
					'array'
				);
				if (transactionResult.isErr()) {
					status.set({
						pending: false,
						error: new Error(
							`Failed to insert row into table ${this.table}: ` + transactionResult.error.message
						)
					});
				} else {
					status.set({
						pending: false,
						result: transactionResult.value.map((item) => this.Generator(item))
					});
				}
			});
		return status;
	}

	/**
	 * Upserts one or more rows.
	 *
	 * @param data - Upsert payloads.
	 * @returns Async status writable containing upserted row wrappers on success.
	 */
	upsert(...data: Insert<Schema, InsertName>[]) {
		this.log('Upserting data with input:', data);
		const status = new SupaStatus<SupaStructData<Schema, RowName>[]>();
		const parsed = z.array((schemas as any)[this.schema]?.[this.table]?.Insert).safeParse(data);
		if (!parsed.success) {
			this.log(`Error validating upsert data for table ${this.table}:`, parsed.error);
			status.set({
				pending: false,
				error: new Error(`Invalid data for table ${this.table}: ` + parsed.error.message)
			});
			return status;
		}

		this.log('Validated upsert data:', parsed.data);
		this.supabase
			.schema(this.schema)
			.from(this.table)
			.upsert(data as any)
			.select('*')
			.then((res) => {
				this.log('Received response for upsert data:', res);
				const transactionResult = this.runTransaction(
					{
						data: res.data as any,
						error: res.error
					},
					'array'
				);
				if (transactionResult.isErr()) {
					status.set({
						pending: false,
						error: new Error(
							`Failed to upsert row into table ${this.table}: ` + transactionResult.error.message
						)
					});
				} else {
					status.set({
						pending: false,
						result: transactionResult.value.map((item) => this.Generator(item))
					});
				}
			});

		return status;
	}

	// getsert(...data: Insert<Name>[]) {
	// 	this.log('Getserting data with input:', data);
	// 	const status = new SupaStatus<SupaStructData<Name>[]>();
	// 	const parsed = z.array(schemas[this.name].Insert).safeParse(data);
	// 	if (!parsed.success) {
	// 		this.log(`Error validating getsert data for table ${this.name}:`, parsed.error);
	// 		status.set({
	// 			pending: false,
	// 			error: new Error(`Invalid data for table ${this.name}: ` + parsed.error.message),
	// 		});
	// 		return status;
	// 	}

	// 	this.log('Validated getsert data:', parsed.data);
	// 	const upsertData = parsed.data as any;
	// 	this.supabase.schema(schemaName).from(this.name).upsert(upsertData, { onConflict: 'id' }).select('*').then((res) => {
	// 		this.log('Received response for getsert data:', res);
	// 		const transactionResult = this.runTransaction({
	// 			data: res.data as any,
	// 			error: res.error,
	// 		}, 'array');
	// 		if (transactionResult.isErr()) {
	// 			status.set({
	// 				pending: false,
	// 				error: new Error(`Failed to getsert row into table ${this.name}: ` + transactionResult.error.message),
	// 			});
	// 		} else {
	// 			status.set({
	// 				pending: false,
	// 				result: transactionResult.value.map((item) => this.Generator(item)),
	// 			});
	// 		}
	// 	});

	// 	return status;
	// }

	/**
	 * Fetches one row by primary id.
	 *
	 * @param id - Row id value.
	 * @returns ResultPromise resolving to row wrapper or `undefined` on failure.
	 *
	 * @example
	 * const result = await usersStruct.fromId('abc123');
	 */
	fromId(id: string, config?: { expires?: Date }) {
		return attemptAsync(async () => {
			if (browser) {
				const cache = await SupaCache.get(
					{ table: this.table, key: `id:${id}` },
					{ pagination: false }
				);
				if (cache.isOk()) {
					const [cached] = cache.value.data;
					if (cached) {
						if (new Date() >= cached.data.expires) {
							cached.delete();
						} else {
							const [data] = cached.data.value;
							if (data) {
								this.log(`Using cached data for id ${id}:`, data);
								return this.Generator(data);
							} else {
								cached.delete();
							}
						}
					}
				}
			}

			const res = await this.supabase
				.schema(this.schema)
				.from(this.table)
				.select('*')
				.filter('id', 'eq', id)
				.single();
			const transactionResult = this.runTransaction(
				{
					data: res.data as any,
					error: res.error
				},
				'single'
			);
			if (transactionResult.isErr()) {
				this.log(`Error fetching fromId ${id} from ${this.table}:`, transactionResult.error);
				return undefined;
			}
			this.log(`Fetched fromId ${id} from ${this.table}:`, transactionResult.value);

			if (browser && transactionResult.value && config?.expires) {
				SupaCache.new({
					table: this.table,
					key: `id:${id}`,
					value: [transactionResult.value],
					expires: config?.expires || new Date(Date.now() + 5 * 60 * 1000) // Cache for 5 minutes
				});
			}

			return this.Generator(transactionResult.value);
		});
	}

	// AND query
	/**
	 * Finds rows where all provided fields are equal.
	 *
	 * @param data - AND filter object.
	 * @param config - Read configuration.
	 * @returns Reactive array of matches.
	 */
	get(
		data: Partial<Row<Schema, RowName>>,
		config: ReadConfig<'all'>
	): SupaStructArray<Schema, RowName>;
	/**
	 * Finds the first row where all provided fields are equal.
	 *
	 * @param data - AND filter object.
	 * @param config - Read configuration.
	 * @returns Async result with first match or `null`.
	 */
	get(
		data: Partial<Row<Schema, RowName>>,
		config: ReadConfig<'single'>
	): ResultPromise<SupaStructData<Schema, RowName> | null>;
	// get(data: Partial<Row<Schema, Name>>, config: ReadConfig<'count'>): ResultPromise<number>;
	// get(data: Partial<Row<Schema, Name>>, config: ReadConfig<'paginated'>): SupaPagination<Name>;
	/**
	 * AND filter read helper with cache and overload-based return types.
	 *
	 * @param data - AND filter object.
	 * @param config - Read configuration.
	 * @returns Overloaded by `config.type`.
	 *
	 * @example
	 * const active = usersStruct.get(
	 *   { username: 'some_username' } as Partial<Row<'users'>>,
	 *   { type: 'all', expires: new Date(Date.now() + 60000) }
	 * );
	 *
	 * @example
	 * const firstAdmin = usersStruct.get(
	 *   { role: 'admin' } as Partial<Row<'users'>>,
	 *   { type: 'single', expires: new Date(Date.now() + 60000) }
	 * );
	 */
	get(
		data: Partial<Row<Schema, RowName>>,
		config: ReadConfig<ReadType>
	): ReadReturnType<Schema, RowName> {
		const cacheKey = JSON.stringify(`get:${JSON.stringify(data)}`);
		const has = this.registeredArrays.get(cacheKey);
		if (has) return has.array;
		const arr = this.arr();

		const get = async () => {
			if (browser) {
				const cache = await SupaCache.get(
					{ table: this.table, key: cacheKey },
					{ pagination: false }
				);
				if (cache.isOk()) {
					const [cached] = cache.value.data;
					if (cached) {
						if (new Date() >= cached.data.expires) {
							cached.delete();
						} else {
							if (config.type === 'single') {
								const [data] = cached.data.value;
								if (data) {
									this.log(`Using cached data for get query ${JSON.stringify(data)}:`, data);
									return [this.Generator(data)];
								} else {
									return [];
								}
							} else {
								this.log(
									`Using cached data for get query ${JSON.stringify(data)}:`,
									cached.data.value
								);
								return cached.data.value.map((i) => this.Generator(i));
							}
						}
					}
				}
			}

			let query = this.supabase.schema(this.schema).from(this.table).select('*');
			for (const [key, value] of Object.entries(data)) {
				query = query.filter(key, 'eq', value);
			}

			if (config.includeArchived !== true) {
				query = query.filter('archived', 'eq', false);
			}

			const res = await query;
			const transactionResult = this.runTransaction(
				{
					data: res.data as any,
					error: res.error
				},
				'array'
			);
			if (transactionResult.isErr()) {
				this.log(
					`Error fetching with get query ${JSON.stringify(data)} from ${this.table}:`,
					transactionResult.error
				);
				return [];
			}

			if (browser && config.expires && res.data?.length) {
				SupaCache.new({
					table: this.table,
					key: cacheKey,
					value: transactionResult.value,
					expires: config.expires
				});
			}

			return transactionResult.value;
		};

		if (config.type === 'single') {
			return attemptAsync(async () => {
				const [res] = await get();
				if (res) {
					this.log(`Fetched with get query ${JSON.stringify(data)} from ${this.table}:`, res);
					return this.Generator(res);
				}
				return null;
			});
		}

		get().then((data) => {
			this.log(`Fetched with get query ${JSON.stringify(data)} from ${this.table}:`, data);
			arr.set(data.map((item) => this.Generator(item)));
		});

		this.registerArray(cacheKey, arr, (row) => {
			for (const [key, value] of Object.entries(data)) {
				if ((row as any)[key] !== value) {
					return false;
				}
			}
			return true;
		});

		return arr;
	}

	/**
	 * Finds rows where at least one provided field matches.
	 *
	 * @param data - OR filter object.
	 * @param config - Read configuration.
	 * @returns Reactive array of matches.
	 */
	getOR(
		data: Partial<Row<Schema, RowName>>,
		config: ReadConfig<'all'>
	): SupaStructArray<Schema, RowName>;
	/**
	 * Finds first row where at least one provided field matches.
	 *
	 * @param data - OR filter object.
	 * @param config - Read configuration.
	 * @returns Async result with first match or `null`.
	 */
	getOR(
		data: Partial<Row<Schema, RowName>>,
		config: ReadConfig<'single'>
	): ResultPromise<SupaStructData<Schema, RowName> | null>;
	// getOR(data: Partial<Row<Schema, Name>>, config: ReadConfig<'count'>): ResultPromise<number>;
	// getOR(data: Partial<Row<Schema, Name>>, config: ReadConfig<'paginated'>): SupaPagination<Name>;
	/**
	 * OR filter read helper with cache and overload-based return types.
	 *
	 * @param data - OR filter object.
	 * @param config - Read configuration.
	 * @returns Overloaded by `config.type`.
	 *
	 * @example
	 * const rows = usersStruct.getOR(
	 *   { role: 'admin', archived: false } as Partial<Row<'users'>>,
	 *   { type: 'all', expires: new Date(Date.now() + 60000) }
	 * );
	 */
	getOR(
		data: Partial<Row<Schema, RowName>>,
		config: ReadConfig<ReadType>
	): ReadReturnType<Schema, RowName> {
		const cacheKey = JSON.stringify(`getOR:${JSON.stringify(data)}`);
		const has = this.registeredArrays.get(cacheKey);
		if (has) return has.array;

		const get = async () => {
			if (browser) {
				const cache = await SupaCache.get(
					{ table: this.table, key: cacheKey },
					{ pagination: false }
				);
				if (cache.isOk()) {
					const [cached] = cache.value.data;
					if (cached) {
						if (new Date() >= cached.data.expires) {
							cached.delete();
						} else {
							if (config.type === 'single') {
								const [data] = cached.data.value;
								if (data) {
									this.log(`Using cached data for getOR query ${JSON.stringify(data)}:`, data);
									return [this.Generator(data)];
								} else {
									return [];
								}
							} else {
								this.log(
									`Using cached data for getOR query ${JSON.stringify(data)}:`,
									cached.data.value
								);
								return cached.data.value.map((i) => this.Generator(i));
							}
						}
					}
				}
			}

			let query = this.supabase.schema(this.schema).from(this.table).select('*');
			const keys = Object.keys(data);
			for (const key of keys) {
				query = query.or(`${key}.eq.${(data as any)[key]}`);
			}

			if (config.includeArchived !== true) {
				query = query.filter('archived', 'eq', false);
			}

			const res = await query;
			const transactionResult = this.runTransaction(
				{
					data: res.data as any,
					error: res.error
				},
				'array'
			);
			if (transactionResult.isErr()) {
				this.log(
					`Error fetching with getOR query ${JSON.stringify(data)} from ${this.table}:`,
					transactionResult.error
				);
				return [];
			}

			if (browser && config.expires && res.data?.length) {
				SupaCache.new({
					table: this.table,
					key: cacheKey,
					value: transactionResult.value,
					expires: config.expires
				});
			}

			return transactionResult.value;
		};

		if (config.type === 'single') {
			return attemptAsync(async () => {
				const [res] = await get();
				if (res) {
					this.log(`Fetched with getOR query ${JSON.stringify(data)} from ${this.table}:`, res);
					return this.Generator(res);
				}
				return null;
			});
		}

		const arr = this.arr();
		get().then((data) => {
			this.log(`Fetched with getOR query ${JSON.stringify(data)} from ${this.table}:`, data);
			arr.set(data.map((item) => this.Generator(item)));
		});

		this.registerArray(cacheKey, arr, (row) => {
			for (const [key, value] of Object.entries(data)) {
				if ((row as any)[key] === value) {
					return true;
				}
			}
			return false;
		});

		return arr;
	}

	/**
	 * Creates an empty typed array container for this struct.
	 *
	 * @returns Empty `SupaStructArray`.
	 */
	arr() {
		return new SupaStructArray<Schema, RowName>([]);
	}

	/**
	 * Runs a structured search query and returns all matches.
	 *
	 * @param query - Recursive query descriptor.
	 * @param config - Read configuration.
	 * @returns Reactive array of matches.
	 */
	search(
		query: SearchQuery<Schema, RowName>,
		config: ReadConfig<'all'>
	): SupaStructArray<Schema, RowName>;
	/**
	 * Runs a structured search query and returns first match.
	 *
	 * @param query - Recursive query descriptor.
	 * @param config - Read configuration.
	 * @returns Async result with first match or `null`.
	 */
	search(
		query: SearchQuery<Schema, RowName>,
		config: ReadConfig<'single'>
	): ResultPromise<SupaStructData<Schema, RowName> | null>;
	// search(query: SearchQuery<Name>, config: ReadConfig<'count'>): ResultPromise<number>;
	// search(query: SearchQuery<Name>, config: ReadConfig<'paginated'>): SupaPagination<Name>;
	/**
	 * Executes structured search with cache-first browser behavior.
	 *
	 * Supports atomic field operations plus nested `and`/`or` conditions.
	 *
	 * @param query - Recursive query descriptor.
	 * @param config - Read configuration.
	 * @returns Overloaded by `config.type`.
	 *
	 * @example
	 * const q: SearchQuery<'users'> = {
	 *   type: 'and',
	 *   conditions: [
	 *     { field: 'archived', operator: 'eq', value: false },
	 *     { field: 'email', operator: 'ilike', value: '%@company.com' }
	 *   ]
	 * };
	 * const staff = usersStruct.search(q, {
	 *   type: 'all',
	 *   expires: new Date(Date.now() + 60000)
	 * });
	 */
	search(
		query: SearchQuery<Schema, RowName>,
		config: ReadConfig<ReadType>
	): ReadReturnType<Schema, RowName> {
		const cacheKey = JSON.stringify(`search:${JSON.stringify(query)}`);
		const has = this.registeredArrays.get(cacheKey);
		if (has) return has.array;
		const arr = this.arr();

		const main = this.supabase.schema(this.schema).from(this.table).select('*');

		const buildQuery = (base: typeof main, q: SearchQuery<Schema, RowName>): typeof main => {
			if ('field' in q) {
				return base.filter(String(q.field), q.operator, q.value);
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
							return `${String(condition.field)}.${condition.operator}.${condition.value}`;
						} else {
							throw new Error('Nested OR conditions are not supported');
						}
					})
					.join(',');
				return base.or(orConditions);
			}

			return base;
		};

		const get = async () => {
			if (browser) {
				const cache = await SupaCache.get(
					{ table: this.table, key: cacheKey },
					{ pagination: false }
				);
				if (cache.isOk()) {
					const [cached] = cache.value.data;
					if (cached) {
						if (new Date() >= cached.data.expires) {
							cached.delete();
						} else {
							if (config.type === 'single') {
								const [data] = cached.data.value;
								if (data) {
									this.log(`Using cached data for search query ${JSON.stringify(query)}:`, data);
									return [this.Generator(data)];
								} else {
									return [];
								}
							} else {
								this.log(
									`Using cached data for search query ${JSON.stringify(query)}:`,
									cached.data.value
								);
								return cached.data.value.map((i) => this.Generator(i));
							}
						}
					}
				}
			}

			let queryBuilder = buildQuery(main, query);

			if (config.includeArchived !== true) {
				queryBuilder = queryBuilder.filter('archived', 'eq', false);
			}

			const res = await queryBuilder;
			const transactionResult = this.runTransaction(
				{
					data: res.data as any,
					error: res.error
				},
				'array'
			);
			if (transactionResult.isErr()) {
				this.log(
					`Error fetching with search query ${JSON.stringify(query)} from ${this.table}:`,
					transactionResult.error
				);
				return [];
			}

			if (browser && config.expires && res.data?.length) {
				SupaCache.new({
					table: this.table,
					key: cacheKey,
					value: transactionResult.value,
					expires: config.expires
				});
			}

			return transactionResult.value;
		};

		if (config.type === 'single') {
			return attemptAsync(async () => {
				const [res] = await get();
				if (res) {
					this.log(`Fetched with search query ${JSON.stringify(query)} from ${this.table}:`, res);
					return this.Generator(res);
				}
				return null;
			});
		}

		get().then((data) => {
			arr.set(data.map((item) => this.Generator(item)));
		});

		this.registerArray(cacheKey, arr, (row) => {
			const evaluateQuery = (q: SearchQuery<Schema, RowName>): boolean => {
				if ('field' in q) {
					const rowValue = (row as any)[q.field];
					switch (q.operator) {
						case 'eq':
							return rowValue === q.value;
						case 'neq':
							return rowValue !== q.value;
						case 'gt':
							return rowValue > q.value;
						case 'gte':
							return rowValue >= q.value;
						case 'lt':
							return rowValue < q.value;
						case 'lte':
							return rowValue <= q.value;
						case 'like':
							return (
								typeof rowValue === 'string' &&
								new RegExp(String(q.value).replace(/%/g, '.*')).test(rowValue)
							);
						case 'ilike':
							return (
								typeof rowValue === 'string' &&
								new RegExp(String(q.value).replace(/%/g, '.*'), 'i').test(rowValue)
							);
						default:
							return false;
					}
				} else {
					const operator = q.type === 'and' ? 'and' : 'or';
					const results = q.conditions.map(evaluateQuery);
					return operator === 'and' ? results.every(Boolean) : results.some(Boolean);
				}
			};
			return evaluateQuery(query);
		});

		return arr;
	}

	/**
	 * Reads archived rows (`archived = true`).
	 *
	 * @returns Reactive array of archived rows.
	 */
	archived() {
		const cacheKey = 'archived';
		const has = this.registeredArrays.get(cacheKey);
		if (has) return has.array;
		const arr = this.arr();
		const get = async () => {
			if (browser) {
				const cache = await SupaCache.get(
					{ table: this.table, key: cacheKey },
					{ pagination: false }
				);
				if (cache.isOk()) {
					const [cached] = cache.value.data;
					if (cached) {
						if (new Date() >= cached.data.expires) {
							cached.delete();
						} else {
							this.log('Using cached data for archived query:', cached.data.value);
							return cached.data.value.map((i) => this.Generator(i));
						}
					}
				}
			}

			const res = await this.supabase
				.schema(this.schema)
				.from(this.table)
				.select('*')
				.filter('archived', 'eq', true);
			const transactionResult = this.runTransaction(
				{
					data: res.data as any,
					error: res.error
				},
				'array'
			);
			if (transactionResult.isErr()) {
				this.log(`Error fetching archived from ${this.table}:`, transactionResult.error);
				return [];
			}

			if (browser) {
				if (res.data?.length) {
					SupaCache.new({
						table: this.table,
						key: cacheKey,
						value: transactionResult.value,
						expires: new Date(Date.now() + 5 * 60 * 1000) // Cache for 5 minutes
					});
				}
			}

			return transactionResult.value;
		};
		get().then((data) => {
			arr.set(data.map((item) => this.Generator(item)));
		});
		this.registerArray(cacheKey, arr, (data) => (data as { archived?: boolean }).archived === true);
		return arr;
	}

	/**
	 * Reads rows by a set of ids.
	 *
	 * @param ids - List of row ids.
	 * @returns Reactive array populated with matching rows.
	 */
	fromIds(ids: string[], config: ReadConfig<'all'>): SupaStructArray<Schema, RowName>;
	fromIds(
		ids: string[],
		config: ReadConfig<'single'>
	): ResultPromise<SupaStructData<Schema, RowName> | null>;
	// fromIds(ids: Row<Schema, Name>['id'][], config: ReadConfig<'count'>): ResultPromise<number>;
	// fromIds(ids: Row<Schema, Name>['id'][], config: ReadConfig<'paginated'>): SupaPagination<Name>;
	fromIds(ids: string[], config: ReadConfig<ReadType>): ReadReturnType<Schema, RowName> {
		const cacheKey = JSON.stringify(`fromIds:${JSON.stringify(ids)}`);
		const has = this.registeredArrays.get(cacheKey);
		if (has) return has.array;
		const arr = this.arr();
		const get = async () => {
			if (browser) {
				const cache = await SupaCache.get(
					{ table: this.table, key: cacheKey },
					{ pagination: false }
				);
				if (cache.isOk()) {
					const [cached] = cache.value.data;
					if (cached) {
						if (new Date() >= cached.data.expires) {
							cached.delete();
						} else {
							this.log(`Using cached data for fromIds query ${ids}:`, cached.data.value);
							return cached.data.value.map((i) => this.Generator(i));
						}
					}
				}
			}

			let query = this.supabase
				.schema(this.schema)
				.from(this.table)
				.select('*')
				.in('id', ids as any);


			if (config.includeArchived !== true) {
				query = query.filter('archived', 'eq', false);
			}

			const res = await query;

			const transactionResult = this.runTransaction(
				{
					data: res.data as any,
					error: res.error
				},
				'array'
			);
			if (transactionResult.isErr()) {
				this.log(`Error fetching fromIds from ${this.table}:`, transactionResult.error);
				return [];
			}

			if (browser) {
				if (res.data?.length) {
					SupaCache.new({
						table: this.table,
						key: cacheKey,
						value: transactionResult.value,
						expires: new Date(Date.now() + 5 * 60 * 1000) // Cache for 5 minutes
					});
				}
			}

			return transactionResult.value;
		};

		if (config.type === 'single') {
			return attemptAsync(async () => {
				const [res] = await get();
				if (res) {
					this.log(`Fetched fromIds query ${ids} from ${this.table}:`, res);
					return this.Generator(res);
				}
				return null;
			});
		}

		get().then((data) => {
			arr.set(data.map((item) => this.Generator(item)));
		});
		this.registerArray(cacheKey, arr, (data) =>
			ids.includes(String((data as { id?: unknown }).id))
		);
		return arr;
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

/**
 * Typed writable array for `SupaStructData` items.
 *
 * @template Name - Table name represented by each array item.
 */
export class SupaStructArray<
	Schema extends RowSchemaName,
	Name extends RowTableNames<Schema>
> extends WritableArray<SupaStructData<Schema, Name>> {}

/**
 * Helper for many-to-many style linking tables between two structs.
 *
 * @template Link - Linking table name.
 * @template TableA - Left table name.
 * @template TableB - Right table name.
 */
export class SupaLinkingStruct<
	LinkSchema extends RowSchemaName,
	Link extends RowTableNames<LinkSchema>,
	SchemaA extends RowSchemaName,
	TableA extends RowTableNames<SchemaA>,
	SchemaB extends RowSchemaName,
	TableB extends RowTableNames<SchemaB>
> {
	private static readonly linkingStructs = new Map<
		string,
		SupaLinkingStruct<
			RowSchemaName,
			RowTableNames<RowSchemaName>,
			RowSchemaName,
			RowTableNames<RowSchemaName>,
			RowSchemaName,
			RowTableNames<RowSchemaName>
		>
	>();

	/**
	 * Creates a linking helper between two table structs.
	 *
	 * @template Link - Linking table name.
	 * @template TableA - Left table name.
	 * @template TableB - Right table name.
	 * @param linkingTable - Join table that stores A/B ids.
	 * @param structA - Left table struct.
	 * @param structB - Right table struct.
	 * @param config - Optional debug config.
	 * @returns Linking helper instance.
	 */
	public static get<
		LinkSchema extends RowSchemaName,
		Link extends RowTableNames<LinkSchema>,
		SchemaA extends RowSchemaName,
		TableA extends RowTableNames<SchemaA>,
		SchemaB extends RowSchemaName,
		TableB extends RowTableNames<SchemaB>
	>(
		schema: LinkSchema,
		linkingTable: Link,
		structA: SupaStruct<SchemaA, TableA>,
		structB: SupaStruct<SchemaB, TableB>,
		config?: {
			debug?: boolean;
		}
	): SupaLinkingStruct<LinkSchema, Link, SchemaA, TableA, SchemaB, TableB> {
		// const key = `${linkingTable}-${structA.name}-${structB.name}`;
		// const existing = SupaLinkingStruct.linkingStructs.get(key);
		// if (existing) return existing as unknown as SupaLinkingStruct<LinkSchema, Link, SchemaA, TableA, TableB>;
		const newStruct = new SupaLinkingStruct(schema, linkingTable, structA, structB, config);
		// if (browser) SupaLinkingStruct.linkingStructs.set(key, newStruct as any);
		return newStruct;
	}

	/**
	 * Creates a linking helper instance.
	 *
	 * @param linkingTable - Join table name.
	 * @param structA - Left table struct.
	 * @param structB - Right table struct.
	 * @param config - Optional debug configuration.
	 */
	constructor(
		public readonly schema: LinkSchema,
		public readonly linkingTable: Link,
		public readonly structA: SupaStruct<SchemaA, TableA>,
		public readonly structB: SupaStruct<SchemaB, TableB>,
		public readonly config: {
			debug?: boolean;
		} = {}
	) {}

	/**
	 * Shared Supabase client, sourced from `structA`.
	 *
	 * @returns Typed client instance.
	 */
	get supabase() {
		return this.structA.supabase;
	}

	/**
	 * Scoped debug logger for linking operations.
	 *
	 * @param args - Values forwarded to `console.log` when debug is enabled.
	 */
	log(...args: unknown[]) {
		if (this.config.debug) {
			console.log(`[SupaLinkingStruct ${String(this.linkingTable)}]`, ...args);
		}
	}

	/**
	 * Creates a join row linking one A record to one B record.
	 *
	 * @param a - Left-side row wrapper.
	 * @param b - Right-side row wrapper.
	 * @returns Async status writable with `null` on success.
	 */
	link(a: SupaStructData<SchemaA, TableA>, b: SupaStructData<SchemaB, TableB>) {
		const status = new SupaStatus<null>();
		this.supabase
			.schema(this.schema)
			.from(String(this.linkingTable))
			.insert({
				[`${this.structA.table}_id`]: (a.data as any).id,
				[`${this.structB.table}_id`]: (b.data as any).id
			} as any)
			.then((res) => {
				if (res.error) {
					status.set({
						pending: false,
						error: new Error(
							`Failed to link ${this.structA.table} and ${this.structB.table}: ` + res.error.message
						)
					});
				} else {
					status.set({
						pending: false,
						result: null
					});
				}
			});
		return status;
	}

	/**
	 * Removes a join row linking one A record to one B record.
	 *
	 * @param a - Left-side row wrapper.
	 * @param b - Right-side row wrapper.
	 * @returns Async status writable with `null` on success.
	 */
	unlink(a: SupaStructData<SchemaA, TableA>, b: SupaStructData<SchemaB, TableB>) {
		const status = new SupaStatus<null>();
		this.supabase
			.schema(this.schema)
			.from(String(this.linkingTable))
			.delete()
			.filter(`${this.structA.table}_id`, 'eq', (a.data as any).id)
			.filter(`${this.structB.table}_id`, 'eq', (b.data as any).id)
			.then((res) => {
				if (res.error) {
					status.set({
						pending: false,
						error: new Error(
							`Failed to unlink ${this.structA.table} and ${this.structB.table}: ` +
								res.error.message
						)
					});
				} else {
					status.set({
						pending: false,
						result: null
					});
				}
			});
		return status;
	}

	/**
	 * Reads all A records linked to a B record.
	 *
	 * @param b - Right-side source record.
	 * @param config - Read configuration (`type: 'all'`).
	 * @returns Writable array of linked A records.
	 */
	getLinkedA(
		b: SupaStructData<SchemaB, TableB>,
		config: ReadConfig<'all'>
	): WritableArray<SupaStructData<SchemaA, TableA>>;
	/**
	 * Reads the first A record linked to a B record.
	 *
	 * @param b - Right-side source record.
	 * @param config - Read configuration (`type: 'single'`).
	 * @returns Async result with first linked A record or `null`.
	 */
	getLinkedA(
		b: SupaStructData<SchemaB, TableB>,
		config: ReadConfig<'single'>
	): ResultPromise<SupaStructData<SchemaA, TableA> | null>;
	/**
	 * Fetches A-side links with browser cache persistence.
	 *
	 * @param b - Right-side source record.
	 * @param config - Read mode and cache expiry.
	 * @returns Overloaded by `config.type`.
	 *
	 * @example
	 * const roles = userRoleLinks.getLinkedA(role, {
	 *   type: 'all',
	 *   expires: new Date(Date.now() + 60000)
	 * });
	 */
	getLinkedA(
		b: SupaStructData<SchemaB, TableB>,
		config: ReadConfig<'all'> | ReadConfig<'single'>
	):
		| WritableArray<SupaStructData<SchemaA, TableA>>
		| ResultPromise<SupaStructData<SchemaA, TableA> | null> {
		const cacheKey = `getLinkedA:${(b.data as any).id}`;

		const get = async (): Promise<SupaStructData<SchemaA, TableA>[]> => {
			if (browser) {
				const cache = await SupaCache.get(
					{ table: String(this.linkingTable), key: cacheKey },
					{ pagination: false }
				);
				if (cache.isOk()) {
					const [cached] = cache.value.data;
					if (cached) {
						if (new Date() >= cached.data.expires) {
							cached.delete();
						} else {
							this.log(
								`Using cached data for getLinkedA ${(b.data as any).id}:`,
								cached.data.value
							);
							return (cached.data.value as PartialRow<SchemaA, TableA>[]).map((i) =>
								this.structA.Generator(i)
							);
						}
					}
				}
			}

			const res = await this.supabase
				.schema(this.schema)
				.from(String(this.linkingTable))
				.select(`*, ${this.structA.table}.*`)
				.filter(`${this.structB.table}_id`, 'eq', (b.data as any).id);

			if (res.error) {
				console.error(
					`Failed to fetch linked ${this.structA.table} for ${this.structB.table} with id ${(b.data as any).id}:`,
					res.error
				);
				return [];
			}

			const rows: PartialRow<SchemaA, TableA>[] =
				res.data?.map((item) => (item as any)[this.structA.table] as PartialRow<SchemaA, TableA>) ||
				[];

			if (browser && config.expires && rows.length) {
				SupaCache.new({
					table: String(this.linkingTable),
					key: cacheKey,
					value: rows,
					expires: config.expires
				});
			}

			return rows.map((i) => this.structA.Generator(i));
		};

		if (config.type === 'single') {
			return attemptAsync(async () => {
				const [data] = await get();
				return data || null;
			});
		}

		const arr: WritableArray<SupaStructData<SchemaA, TableA>> = this.structA.arr();
		get().then((data) => arr.set(data));
		return arr;
	}

	/**
	 * Reads all B records linked to an A record.
	 *
	 * @param b - Left-side source record.
	 * @param config - Read configuration (`type: 'all'`).
	 * @returns Writable array of linked B records.
	 */
	getLinkedB(
		b: SupaStructData<SchemaA, TableA>,
		config: ReadConfig<'all'>
	): WritableArray<SupaStructData<SchemaB, TableB>>;
	/**
	 * Reads the first B record linked to an A record.
	 *
	 * @param b - Left-side source record.
	 * @param config - Read configuration (`type: 'single'`).
	 * @returns Async result with first linked B record or `null`.
	 */
	getLinkedB(
		b: SupaStructData<SchemaA, TableA>,
		config: ReadConfig<'single'>
	): ResultPromise<SupaStructData<SchemaB, TableB> | null>;
	/**
	 * Fetches B-side links with browser cache persistence.
	 *
	 * @param b - Left-side source record.
	 * @param config - Read mode and cache expiry.
	 * @returns Overloaded by `config.type`.
	 *
	 * @example
	 * const firstRole = userRoleLinks.getLinkedB(user, {
	 *   type: 'single',
	 *   expires: new Date(Date.now() + 60000)
	 * });
	 */
	getLinkedB(
		b: SupaStructData<SchemaA, TableA>,
		config: ReadConfig<'all'> | ReadConfig<'single'>
	):
		| WritableArray<SupaStructData<SchemaB, TableB>>
		| ResultPromise<SupaStructData<SchemaB, TableB> | null> {
		const cacheKey = `getLinkedB:${(b.data as any).id}`;

		const get = async (): Promise<SupaStructData<SchemaB, TableB>[]> => {
			if (browser) {
				const cache = await SupaCache.get(
					{ table: String(this.linkingTable), key: cacheKey },
					{ pagination: false }
				);
				if (cache.isOk()) {
					const [cached] = cache.value.data;
					if (cached) {
						if (new Date() >= cached.data.expires) {
							cached.delete();
						} else {
							this.log(
								`Using cached data for getLinkedB ${(b.data as any).id}:`,
								cached.data.value
							);
							return (cached.data.value as PartialRow<SchemaB, TableB>[]).map((i) =>
								this.structB.Generator(i)
							);
						}
					}
				}
			}

			const res = await this.supabase
				.schema(this.schema)
				.from(String(this.linkingTable))
				.select(`*, ${this.structB.table}.*`)
				.filter(`${this.structA.table}_id`, 'eq', (b.data as any).id);

			if (res.error) {
				console.error(
					`Failed to fetch linked ${this.structB.table} for ${this.structA.table} with id ${(b.data as any).id}:`,
					res.error
				);
				return [];
			}

			const rows: PartialRow<SchemaB, TableB>[] =
				res.data?.map((item) => (item as any)[this.structB.table] as PartialRow<SchemaB, TableB>) ||
				[];

			if (browser && config.expires && rows.length) {
				SupaCache.new({
					table: String(this.linkingTable),
					key: cacheKey,
					value: rows,
					expires: config.expires
				});
			}

			return rows.map((i) => this.structB.Generator(i));
		};

		if (config.type === 'single') {
			return attemptAsync(async () => {
				const [data] = await get();
				return data || null;
			});
		}

		const arr: WritableArray<SupaStructData<SchemaB, TableB>> = this.structB.arr();
		get().then((data) => arr.set(data));
		return arr;
	}
}
