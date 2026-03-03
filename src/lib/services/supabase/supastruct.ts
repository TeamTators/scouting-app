/* eslint-disable @typescript-eslint/no-explicit-any */
// import supabase from "$lib/services/supabase";
import { type Database } from '$lib/types/supabase';
import { attempt, attemptAsync, ComplexEventEmitter, ResultPromise, type Result } from 'ts-utils';
import { WritableArray, WritableBase } from '../writables';
import { type SchemaName, schemaName } from '$lib/types/supabase-schema';
import { RealtimeChannel, type createClient } from '@supabase/supabase-js';
import { schemas } from '$lib/types/supabase-zod';
import z from 'zod';
import { browser } from '$app/environment';
import { SupaStaging } from './supastaging';

export type DB = Omit<Database, 'public'>;
export type Client = ReturnType<typeof createClient<DB>>;

export type Table<Name extends keyof Database[SchemaName]['Tables']> =
	Database[SchemaName]['Tables'][Name];
export type Names = keyof Database[SchemaName]['Tables'];
export type Row<Name extends Names> = Table<Name>['Row'];
export type Insert<Name extends Names> = Table<Name>['Insert'];
export type Update<Name extends Names> = Table<Name>['Update'];
export type PartialRow<Name extends Names> = Partial<Row<Name>>;

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
	constructor() {
		super({
			pending: true
		});
	}
}

export type SupaConfig<Name> = {
	name: Name;
	client: Client;
	versionHistory?: boolean;
	debug?: boolean;
	subscribe?: boolean;
};

export type ReadType = 'paginated' | 'all' | 'single' | 'count';

export type ReadReturnType<Name extends Names> = SupaStructArray<Name> | SupaPagination<Name> | ResultPromise<SupaStructData<Name> | null> | ResultPromise<number>;

export type ReadConfig<T extends ReadType> = {
	type: T;
} & (T extends 'all' ? {

} : T extends 'paginated' ? {
	limit: number;
	page: number;
} : T extends 'single' ? {

} : T extends 'count' ? {
	
} : never);

export class SupaStruct<Name extends Names> {
	public static readonly structs = new Map<string, SupaStruct<Names>>();

	public static get<Name extends Names>(config: SupaConfig<Name>): SupaStruct<Name> {
		// const existing = SupaStruct.structs.get(config.name);
		// if (existing) return existing as unknown as SupaStruct<Name>;
		return new SupaStruct(config);
	}

	private readonly cache = new Map<string, SupaStructData<Name>>();
	private readonly em = new ComplexEventEmitter<{
		new: [SupaStructData<Name>];
		update: [SupaStructData<Name>];
		delete: [SupaStructData<Name>];
		archive: [SupaStructData<Name>];
		restore: [SupaStructData<Name>];
	}>();

	private readonly channel: RealtimeChannel;

	constructor(public readonly config: SupaConfig<Name>) {
		console.log(`${this.name} Debug:`, config.debug);
		this.channel = this.supabase.channel(`struct-${schemaName}.${config.name}`);
		// SupaStruct.structs.set(this.config.name, this as any);
		this.log(`Initialized struct for table ${this.name}`);
	}

	get name() {
		return this.config.name;
	}

	get supabase() {
		return this.config.client;
	}

	private log(...args: unknown[]) {
		// if (this.config.debug) {
			console.log(`[SupaStruct ${this.name}]`, ...args);
		// }
	}

	private listening = false;

	private setupListeners() {
		if (this.listening) return false;
		this.listening = true;
		this.channel.on(
			'postgres_changes',
			{
				event: 'INSERT',
				schema: schemaName,
				table: this.name
			},
			(payload) => {
				this.log('Received new data payload:', payload);
				const data = this.Generator(payload.new);
				this.log('Received new data:', data);
				this.em.emit('new', data);

				for (const { array, satisfies } of this.registeredArrays.values()) {
					if (satisfies(data.data) && !array.data.includes(data)) {
						array.push(data);
					}
				}
			}
		);

		this.channel.on(
			'postgres_changes',
			{
				event: 'UPDATE',
				schema: schemaName,
				table: this.name
			},
			(payload) => {
				this.log('Received updated data payload:', payload);
				const data = this.Generator(payload.new);
				this.log('Received updated data:', data);
				this.em.emit('update', data);

				if ('archived' in payload.new) {
					if (payload.new.archived && !payload.old.archived) {
						this.log('Received archived data:', data);
						this.em.emit('archive', data);
					} else if (!payload.new.archived && payload.old.archived) {
						this.log('Received restored data:', data);
						this.em.emit('restore', data);
					}
				}

				for (const { array, satisfies } of this.registeredArrays.values()) {
					const has = array.data.find((item) => String(item.data.id) === String(data.data.id));
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
		);

		this.channel.on(
			'postgres_changes',
			{
				event: 'DELETE',
				schema: schemaName,
				table: this.name
			},
			(payload) => {
				this.log('Received deleted data payload:', payload);
				if ('old' in payload) {
					const cached = this.cache.get(String(payload.old.id));
					if (cached) {
						this.log('Received deleted data:', cached);
						this.em.emit('delete', cached);
						this.cache.delete(String(cached.data.id));
						for (const { array } of this.registeredArrays.values()) {
							array.remove(cached);
						}
					}
				}
			}
		);
		return true;
	}

	runTransaction(
		transaction: {
			data: Row<Name>[] | Row<Name> | null;
			error: Error | null;
		},
		expect: 'array'
	): Result<Row<Name>[]>;
	runTransaction(
		transaction: {
			data: Row<Name>[] | Row<Name> | null;
			error: Error | null;
		},
		expect: 'single'
	): Result<Row<Name>>;
	runTransaction(
		transaction: {
			data: Row<Name>[] | Row<Name> | null;
			error: Error | null;
		},
		expect: 'null'
	): Result<null>;
	runTransaction(
		transaction: {
			data: Row<Name>[] | Row<Name> | null;
			error: Error | null;
		},
		expect: 'array' | 'single' | 'null'
	): Result<Row<Name>[] | Row<Name> | null> {
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

	get sample(): SupaStructData<Name> {
		throw new Error('Sample should never be used at runtime');
	}

	private readonly registeredArrays = new Map<
		string,
		{
			array: SupaStructArray<Name>;
			satisfies: (data: PartialRow<Name>) => boolean;
		}
	>();

	private unsub(timeout?: number) {
		return attempt(() => this.channel.unsubscribe(timeout));
	}

	private sub(fn?: (status: string) => void) {
		return attempt(() => this.channel.subscribe(fn));
	}

	registerArray(
		name: string,
		array: SupaStructArray<Name>,
		satisfies: (data: PartialRow<Name>) => boolean
	) {
		if (browser){
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

	Generator(row: unknown) {
		const validated = this.validate(row);
		const has = this.cache.get(String(validated.id));
		if (has) return has;
		const data = new SupaStructData(this, validated as PartialRow<Name>);
		if (browser) this.cache.set(String(validated.id), data);
		return data;
	}

	validate(data: unknown) {
		const schema = schemas[this.name];
		if (!schema) {
			throw new Error(`No schema found for table ${this.name}`);
		}
		const parseResult = schema.Row.partial().safeParse(data);
		if (!parseResult.success) {
			throw new Error(
				`Failed to validate data for table ${this.name}: ` + parseResult.error.message
			);
		}
		return parseResult.data;
	}

	// TODO: Integrate pagination and count into
	all(config: ReadConfig<'all'>): SupaStructArray<Name>;
	// all(config: ReadConfig<'paginated'>): SupaPagination<Name>;
	all(config: ReadConfig<'single'>): ResultPromise<SupaStructData<Name> | null>;
	// all(config: ReadConfig<'count'>): ResultPromise<number>;
	all(config: ReadConfig<ReadType>): ReadReturnType<Name> {
		const has = this.registeredArrays.get('all');
		if (has) return has.array;

		const get = async () => {
			const res = this.runTransaction(
				await this.supabase.schema(schemaName).from(this.name).select('*'),
				'array'
			);
			if (res.isErr()) {
				this.log('Error fetching all data:', res.error);
				return [];
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
		this.registerArray('all', arr, (data) => data.archived === false);
		return arr;
	}

	new(...data: Insert<Name>[]) {
		this.log('Creating new data with input:', data);
		const status = new SupaStatus<SupaStructData<Name>[]>();
		const parsed = z.array(schemas[this.name].Insert).safeParse(data);
		if (parsed.success === false) {
			this.log(`Error validating new data for table ${this.name}:`, parsed.error);
			status.set({
				pending: false,
				error: new Error(`Invalid data for table ${this.name}: ` + parsed.error.message)
			});
			return status;
		}
		this.log('Validated new data:', parsed.data);
		this.supabase
			.schema(schemaName)
			.from(this.name)
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
							`Failed to insert row into table ${this.name}: ` + transactionResult.error.message
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

	upsert(...data: Insert<Name>[]) {
		this.log('Upserting data with input:', data);
		const status = new SupaStatus<SupaStructData<Name>[]>();
		const parsed = z.array(schemas[this.name].Insert).safeParse(data);
		if (!parsed.success) {
			this.log(`Error validating upsert data for table ${this.name}:`, parsed.error);
			status.set({
				pending: false,
				error: new Error(`Invalid data for table ${this.name}: ` + parsed.error.message),
			});
			return status;
		}

		this.log('Validated upsert data:', parsed.data);
		this.supabase.schema(schemaName).from(this.name).upsert(data as any).select('*').then((res) => {
			this.log('Received response for upsert data:', res);
			const transactionResult = this.runTransaction({
				data: res.data as any,
				error: res.error,
			}, 'array');
			if (transactionResult.isErr()) {
				status.set({
					pending: false,
					error: new Error(`Failed to upsert row into table ${this.name}: ` + transactionResult.error.message),
				});
			} else {
				status.set({
					pending: false,
					result: transactionResult.value.map((item) => this.Generator(item)),
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

	fromId(id: Row<Name>['id']) {
		return attemptAsync(async () => {
			const res = await this.supabase
				.schema(schemaName)
				.from(this.name)
				.select('*')
				.eq('id', id as any)
				.single();
			const transactionResult = this.runTransaction(
				{
					data: res.data as any,
					error: res.error
				},
				'single'
			);
			if (transactionResult.isErr()) {
				this.log(`Error fetching fromId ${id} from ${this.name}:`, transactionResult.error);
				return undefined;
			}
			this.log(`Fetched fromId ${id} from ${this.name}:`, transactionResult.value);
			return this.Generator(transactionResult.value);
		});
	}

	// AND query
	get(data: Partial<Row<Name>>, config: ReadConfig<'all'>): SupaStructArray<Name>;
	get(data: Partial<Row<Name>>, config: ReadConfig<'single'>): ResultPromise<SupaStructData<Name> | null>;
	// get(data: Partial<Row<Name>>, config: ReadConfig<'count'>): ResultPromise<number>;
	// get(data: Partial<Row<Name>>, config: ReadConfig<'paginated'>): SupaPagination<Name>;
	get(data: Partial<Row<Name>>, config: ReadConfig<ReadType>): ReadReturnType<Name> {
		const cacheKey = JSON.stringify(`get:${JSON.stringify(data)}`);
		const has = this.registeredArrays.get(cacheKey);
		if (has) return has.array;
		const arr = this.arr();

		const get = async () => {
			let query = this.supabase.schema(schemaName).from(this.name).select('*');
			for (const [key, value] of Object.entries(data)) {
				query = query.eq(key, value as any);
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
					`Error fetching with get query ${JSON.stringify(data)} from ${this.name}:`,
					transactionResult.error
				);
				return [];
			}
			return transactionResult.value;
		};

		if (config.type === 'single') {
			return attemptAsync(async () => {
				const [res] = await get();
				if (res) {
					this.log(`Fetched with get query ${JSON.stringify(data)} from ${this.name}:`, res);
					return this.Generator(res);
				}
				return null;
			});
		}

		get().then((data) => {
			this.log(`Fetched with get query ${JSON.stringify(data)} from ${this.name}:`, data);
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

	getOR(data: Partial<Row<Name>>, config: ReadConfig<'all'>): SupaStructArray<Name>;
	getOR(data: Partial<Row<Name>>, config: ReadConfig<'single'>): ResultPromise<SupaStructData<Name> | null>;
	// getOR(data: Partial<Row<Name>>, config: ReadConfig<'count'>): ResultPromise<number>;
	// getOR(data: Partial<Row<Name>>, config: ReadConfig<'paginated'>): SupaPagination<Name>;
	getOR(data: Partial<Row<Name>>, config: ReadConfig<ReadType>): ReadReturnType<Name> {
		const cacheKey = JSON.stringify(`getOR:${JSON.stringify(data)}`);
		const has = this.registeredArrays.get(cacheKey);
		if (has) return has.array;

		const get = async () => {
			let query = this.supabase.schema(schemaName).from(this.name).select('*');
			const keys = Object.keys(data);
			for (const key of keys) {
				query = query.or(`${key}.eq.${(data as any)[key]}`);
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
					`Error fetching with getOR query ${JSON.stringify(data)} from ${this.name}:`,
					transactionResult.error
				);
				return [];
			}
			return transactionResult.value;
		}

		if (config.type === 'single') {
			return attemptAsync(async () => {
				const [res] = await get();
				if (res) {
					this.log(`Fetched with getOR query ${JSON.stringify(data)} from ${this.name}:`, res);
					return this.Generator(res);
				}
				return null;
			});
		}

		const arr = this.arr();
		get().then(data => {
			this.log(`Fetched with getOR query ${JSON.stringify(data)} from ${this.name}:`, data);
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

	arr() {
		return new SupaStructArray<Name>([]);
	}

	search(query: SearchQuery<Name>) {
		const cacheKey = JSON.stringify(`search:${JSON.stringify(query)}`);
		const has = this.registeredArrays.get(cacheKey);
		if (has) return has.array;
		const arr = this.arr();

		const main = this.supabase.schema(schemaName).from(this.name).select('*');

		const buildQuery = (base: typeof main, q: SearchQuery<Name>): typeof main => {
			if ('field' in q) {
				return base.filter(String(q.field), q.operator, q.value as any);
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
			const queryBuilder = buildQuery(main, query);
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
					`Error fetching with search query ${JSON.stringify(query)} from ${this.name}:`,
					transactionResult.error
				);
				return [];
			}
			return transactionResult.value;
		};

		get().then((data) => {
			arr.set(data.map((item) => this.Generator(item)));
		});

		this.registerArray(cacheKey, arr, (row) => {
			const evaluateQuery = (q: SearchQuery<Name>): boolean => {
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

	archived() {
		const cacheKey = 'archived';
		const has = this.registeredArrays.get(cacheKey);
		if (has) return has.array;
		const arr = this.arr();
		const get = async () => {
			const res = await this.supabase
				.schema(schemaName)
				.from(this.name)
				.select('*')
				.eq('archived', true as any);
			const transactionResult = this.runTransaction(
				{
					data: res.data as any,
					error: res.error
				},
				'array'
			);
			if (transactionResult.isErr()) {
				this.log(`Error fetching archived from ${this.name}:`, transactionResult.error);
				return [];
			}
			return transactionResult.value;
		};
		get().then((data) => {
			arr.set(data.map((item) => this.Generator(item)));
		});
		this.registerArray(cacheKey, arr, (data) => data.archived === true);
		return arr;
	}

	fromIds(ids: Row<Name>['id'][]) {
		const cacheKey = JSON.stringify(`fromIds:${JSON.stringify(ids)}`);
		const has = this.registeredArrays.get(cacheKey);
		if (has) return has.array;
		const arr = this.arr();
		const get = async () => {
			const res = await this.supabase
				.schema(schemaName)
				.from(this.name)
				.select('*')
				.in('id', ids as any);
			const transactionResult = this.runTransaction(
				{
					data: res.data as any,
					error: res.error
				},
				'array'
			);
			if (transactionResult.isErr()) {
				this.log(`Error fetching fromIds from ${this.name}:`, transactionResult.error);
				return [];
			}
			return transactionResult.value;
		};
		get().then((data) => {
			arr.set(data.map((item) => this.Generator(item)));
		});
		this.registerArray(cacheKey, arr, (data) => ids.includes(String(data.id)));
		return arr;
	}
}

export type SearchQuery<Name extends Names> =
	| {
			field: keyof Row<Name>;
			operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike';
			value: Row<Name>[keyof Row<Name>];
	  }
	| {
			type: 'and' | 'or';
			conditions: SearchQuery<Name>[];
	  };

export class SupaStructArray<Name extends Names> extends WritableArray<SupaStructData<Name>> {}

export class SupaStructData<Name extends Names> extends WritableBase<PartialRow<Name>> {
	constructor(
		public readonly struct: SupaStruct<Name>,
		data: PartialRow<Name>
	) {
		super(data);
	}

	private _log(...args: unknown[]) {
		this.struct['log'](`Data with id ${this.data.id}:`, ...args);
	}

	get supabase() {
		return this.struct.supabase;
	}

	update(fn: (data: PartialRow<Name>) => PartialRow<Name>) {
		const status = new SupaStatus<PartialRow<Name>>();
		try {
			const updateData = fn(this.data);
			this.supabase
				.from(this.struct.name)
				.update(updateData as any)
				.eq('id', this.data.id as any)
				.select('*')
				.then((res) => {
					const transactionResult = this.struct.runTransaction(
						{
							data: res.data ? res.data[0] : (null as any),
							error: res.error
						},
						'single'
					);
					if (transactionResult.isErr()) {
						this._log('Error updating data:', transactionResult.error);
						status.set({
							pending: false,
							error: new Error(
								`Failed to update row in table ${this.struct.name}: ` +
									transactionResult.error.message
							)
						});
					} else {
						status.set({
							pending: false,
							result: transactionResult.value
						});
					}
				});
		} catch (error) {
			status.set({
				pending: false,
				error: error instanceof Error ? error : new Error(String(error))
			});
		}
		return status;
	}

	delete() {
		const status = new SupaStatus<null>();
		this.supabase
			.from(this.struct.name)
			.delete()
			.eq('id', this.data.id as any)
			.then((res) => {
				const transactionResult = this.struct.runTransaction(
					{
						data: null,
						error: res.error
					},
					'null'
				);
				if (transactionResult.isErr()) {
					this._log('Error deleting data:', transactionResult.error);
					status.set({
						pending: false,
						error: new Error(
							`Failed to delete row in table ${this.struct.name}: ` +
								transactionResult.error.message
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

	staging() {
		return new SupaStaging(this);
	}

	derivedProperty(name: keyof Row<Name>) {
		const state = new WritableBase<Row<Name>[keyof Row<Name>] | undefined>(this.data[name]);
		let currentValue = this.data[name];
		state.on(
			'all-unsubscribe',
			this.subscribe((data) => {
				if (data[name] !== currentValue) {
					currentValue = data[name];
					state.set(data[name]);
				}
			})
		);
		return state;
	}
}

export class SupaPagination<Name extends Names> extends WritableBase<{
	rows: SupaStructData<Name>[];
	total: number;
	page: number;
	pageSize: number;
	hasNextPage: boolean;
	hasPreviousPage: boolean;
}> {
	constructor(
		public readonly struct: SupaStruct<Name>,
		private readonly getter: (
			page: number,
			pageSize: number
		) => Promise<{
			rows: Row<Name>[];
			total: number;
			page: number;
			pageSize: number;
			hasNextPage: boolean;
			hasPreviousPage: boolean;
		}>
	) {
		super({
			rows: [],
			total: 0,
			page: 1,
			pageSize: 10,
			hasNextPage: false,
			hasPreviousPage: false
		});
	}

	private fetch(page: number, pageSize: number) {
		this.getter(page, pageSize)
			.then((result) => {
				this.set({
					rows: result.rows.map((item) => this.struct.Generator(item)),
					total: result.total,
					page: result.page,
					pageSize: result.pageSize,
					hasNextPage: result.hasNextPage,
					hasPreviousPage: result.hasPreviousPage
				});
			})
			.catch((error) => {
				console.error(
					`Failed to fetch page ${page} with page size ${pageSize} from table ${this.struct.name}:`,
					error
				);
			});
	}

	next() {
		if (!this.data.hasNextPage) return;
		this.fetch(this.data.page + 1, this.data.pageSize);
	}

	prev() {
		if (!this.data.hasPreviousPage) return;
		this.fetch(this.data.page - 1, this.data.pageSize);
	}

	setPageSize(pageSize: number) {
		this.fetch(1, pageSize);
	}

	get pageSize() {
		return this.derived((data) => data.pageSize);
	}

	get page() {
		return this.derived((data) => data.page);
	}

	get total() {
		return this.derived((data) => data.total);
	}

	get hasNextPage() {
		return this.derived((data) => data.hasNextPage);
	}

	get hasPreviousPage() {
		return this.derived((data) => data.hasPreviousPage);
	}

	get rows() {
		return this.derived((data) => data.rows);
	}
}

export class SupaLinkingStruct<Link extends Names, TableA extends Names, TableB extends Names> {
	private static readonly linkingStructs = new Map<
		string,
		SupaLinkingStruct<Names, Names, Names>
	>();

	public static get<Link extends Names, TableA extends Names, TableB extends Names>(
		linkingTable: Link,
		structA: SupaStruct<TableA>,
		structB: SupaStruct<TableB>,
		config?: {
			debug?: boolean;
		}
	): SupaLinkingStruct<Link, TableA, TableB> {
		// const key = `${linkingTable}-${structA.name}-${structB.name}`;
		// const existing = SupaLinkingStruct.linkingStructs.get(key);
		// if (existing) return existing as unknown as SupaLinkingStruct<Link, TableA, TableB>;
		const newStruct = new SupaLinkingStruct(linkingTable, structA, structB, config);
		// if (browser) SupaLinkingStruct.linkingStructs.set(key, newStruct as any);
		return newStruct;
	}

	constructor(
		public readonly linkingTable: Link,
		public readonly structA: SupaStruct<TableA>,
		public readonly structB: SupaStruct<TableB>,
		public readonly config: {
			debug?: boolean;
		} = {}
	) {}

	get supabase() {
		return this.structA.supabase;
	}

	log(...args: unknown[]) {
		if (this.config.debug) {
			console.log(`[SupaLinkingStruct ${this.linkingTable}]`, ...args);
		}
	}

	link(a: SupaStructData<TableA>, b: SupaStructData<TableB>) {
		const status = new SupaStatus<null>();
		this.supabase
			.from(this.linkingTable)
			.insert({
				[`${this.structA.name}_id`]: a.data.id,
				[`${this.structB.name}_id`]: b.data.id
			} as any)
			.then((res) => {
				if (res.error) {
					status.set({
						pending: false,
						error: new Error(
							`Failed to link ${this.structA.name} and ${this.structB.name}: ` + res.error.message
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

	unlink(a: SupaStructData<TableA>, b: SupaStructData<TableB>) {
		const status = new SupaStatus<null>();
		this.supabase
			.from(this.linkingTable)
			.delete()
			.eq(`${this.structA.name}_id`, a.data.id as any)
			.eq(`${this.structB.name}_id`, b.data.id as any)
			.then((res) => {
				if (res.error) {
					status.set({
						pending: false,
						error: new Error(
							`Failed to unlink ${this.structA.name} and ${this.structB.name}: ` + res.error.message
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

	getLinkedA(b: SupaStructData<TableB>) {
		const arr = this.structA.arr();
		this.supabase
			.from(this.linkingTable)
			.select(`*, ${this.structA.name}.*`)
			.eq(`${this.structB.name}_id`, b.data.id as any)
			.then((res) => {
				if (res.error) {
					console.error(
						`Failed to fetch linked ${this.structA.name} for ${this.structB.name} with id ${b.data.id}:`,
						res.error
					);
				} else {
					arr.set(
						res.data?.map((item) => this.structA.Generator((item as any)[this.structA.name])) || []
					);
				}
			});
		return arr;
	}

	getLinkedB(a: SupaStructData<TableA>) {
		const arr = this.structB.arr();
		this.supabase
			.from(this.linkingTable)
			.select(`*, ${this.structB.name}.*`)
			.eq(`${this.structA.name}_id`, a.data.id as any)
			.then((res) => {
				if (res.error) {
					console.error(
						`Failed to fetch linked ${this.structB.name} for ${this.structA.name} with id ${a.data.id}:`,
						res.error
					);
				} else {
					arr.set(
						res.data?.map((item) => this.structB.Generator((item as any)[this.structB.name])) || []
					);
				}
			});
		return arr;
	}
}
