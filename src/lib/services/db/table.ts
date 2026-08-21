/**
 * @fileoverview
 * SupaStruct-style IndexedDB table gateway built on Dexie.
 *
 * This module mirrors the interaction model used by SupaStruct:
 * - `Table`: table-scoped CRUD/query entry point.
 * - `TableQuery`: lazy query wrapper with reactive cache views.
 * - `TablePagination`: page state and paginated fetch orchestration.
 * - `TableData`: row wrapper with update/delete helpers.
 */
import { attemptAsync, type ResultPromise } from 'ts-utils';
import { Err, Ok, type Result } from 'ts-utils';
import { _define, _init } from '.';
import { browser } from '$app/environment';
import { z } from 'zod';

export type Row<_Name extends string, Schema extends z.ZodTypeAny> = z.output<Schema> & {
	id: string;
	created_at: Date;
};

export type Insert<Schema extends z.ZodTypeAny> = {
	[K in keyof z.output<Schema>]: z.output<Schema>[K];
} & {
	id: string;
	created_at: Date;
};

export type Update<Schema extends z.ZodTypeAny> = Partial<Insert<Schema>>;

export type SearchQuery<Name extends string, Schema extends z.ZodTypeAny> =
	| {
			field: keyof Row<Name, Schema>;
			operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike';
			value: Row<Name, Schema>[keyof Row<Name, Schema>];
	  }
	| {
			type: 'and' | 'or';
			conditions: SearchQuery<Name, Schema>[];
	  };

type PaginatedResponse<T> = {
	data: T[];
	count: number;
};

export type TableConfig<Name extends string, Schema extends z.ZodTypeAny> = {
	name: Name;
	schema: Schema;
	debug?: boolean;
};

export class DexieTable<Name extends string, Schema extends z.ZodTypeAny> {
	public static readonly tables = new Map<string, DexieTable<string, z.ZodTypeAny>>();

	public static get<Name extends string, Schema extends z.ZodTypeAny>(
		config: TableConfig<Name, Schema>
	) {
		if (!browser) throw new Error('Table access is only available in the browser');
		const key = config.name;
		const existing = DexieTable.tables.get(key);
		if (existing) {
			return existing as unknown as DexieTable<Name, Schema>;
		}
		const created = new DexieTable(config);
		DexieTable.tables.set(key, created as unknown as DexieTable<string, z.ZodTypeAny>);
		return created;
	}

	public readonly cache = new Map<string, DexieData<Name, Schema>>();
	private readonly tableDef: ReturnType<typeof _define<Schema>>;

	constructor(private readonly config: TableConfig<Name, Schema>) {
		this.tableDef = _define(config.name, config.schema);
	}

	private log(...args: unknown[]) {
		if (this.config.debug) {
			console.log(`[Table:${this.config.name}] (${new Date().toISOString()})`, ...args);
		}
	}

	private ensureDate(value: Date | Date | string | undefined, fallback: Date | Date = new Date()) {
		if (!(fallback instanceof Date)) {
			fallback = new Date(fallback);
		}
		if (!value) return fallback;
		if (value instanceof Date) return value;
		return new Date(value);
	}

	private toComparable(v: unknown): number | string | null {
		if (v instanceof Date) return v.getTime();
		if (typeof v === 'number' || typeof v === 'string') return v;
		return null;
	}

	private evaluateOp(
		operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike',
		left: unknown,
		right: unknown
	) {
		switch (operator) {
			case 'eq':
				return left === right;
			case 'neq':
				return left !== right;
			case 'gt': {
				const l = this.toComparable(left);
				const r = this.toComparable(right);
				return l !== null && r !== null && l > r;
			}
			case 'gte': {
				const l = this.toComparable(left);
				const r = this.toComparable(right);
				return l !== null && r !== null && l >= r;
			}
			case 'lt': {
				const l = this.toComparable(left);
				const r = this.toComparable(right);
				return l !== null && r !== null && l < r;
			}
			case 'lte': {
				const l = this.toComparable(left);
				const r = this.toComparable(right);
				return l !== null && r !== null && l <= r;
			}
			case 'like':
				return typeof left === 'string' && typeof right === 'string' && left.includes(right);
			case 'ilike':
				return (
					typeof left === 'string' &&
					typeof right === 'string' &&
					left.toLowerCase().includes(right.toLowerCase())
				);
		}
	}

	private async rows() {
		this.log('Fetching all rows from table');
		const db = await _init();
		this.log('Database initialized:', db);
		// return this.tableDef().toArray();
		return db.table(this.config.name).toArray();
	}

	Generator(row: Row<Name, Schema>) {
		this.log('Generating data for row', row);
		const has = this.cache.get(row.id);
		if (has) {
			this.log('Cache hit for row', row.id);
			Object.assign(has.raw, row);
			return has;
		}
		const created = new DexieData(this, row);
		this.cache.set(row.id, created);
		return created;
	}

	all() {
		this.log('Fetching all data');
		const satisfies = (_: DexieData<Name, Schema>) => true;

		const allQuery = async () => {
			this.log('Executing all() query');
			const rows = await this.rows();
			return rows.map((row) => this.Generator(row));
		};

		const paginateQuery = async (page: number, size: number) => {
			this.log(`Executing all() paginated query for page ${page} with size ${size}`);
			const rows = await this.rows();
			const from = Math.max(0, (page - 1) * size);
			const to = from + size;
			const pageRows = rows.slice(from, to);
			return {
				data: pageRows.map((row) => this.Generator(row)),
				count: rows.length
			};
		};

		const query = new DexieQuery(this, satisfies, allQuery, paginateQuery);
		return query;
	}

	get(queryData: Partial<Row<Name, Schema>>) {
		this.log('Fetching data with query', queryData);
		const satisfies = (data: DexieData<Name, Schema>) =>
			Object.entries(queryData).every(
				([key, value]) => data.raw[key as keyof Row<Name, Schema>] === value
			);

		const allQuery = async () => {
			this.log('Executing get() query with data', queryData);
			const rows = await this.rows();
			const filtered = rows.map((row) => this.Generator(row)).filter(satisfies);
			return filtered;
		};

		const paginateQuery = async (page: number, size: number) => {
			this.log(
				`Executing get() paginated query for page ${page} with size ${size} and data`,
				queryData
			);
			const rows = (await allQuery()).map((item) => item.raw);
			const from = Math.max(0, (page - 1) * size);
			const to = from + size;
			const pageRows = rows.slice(from, to);
			return {
				data: pageRows.map((row) => this.Generator(row)),
				count: rows.length
			};
		};

		const query = new DexieQuery(this, satisfies, allQuery, paginateQuery);
		return query;
	}

	getOR(queryData: Partial<Row<Name, Schema>>) {
		const entries = Object.entries(queryData);
		const satisfies = (data: DexieData<Name, Schema>) =>
			entries.some(([key, value]) => data.raw[key as keyof Row<Name, Schema>] === value);

		const allQuery = async () => {
			this.log('Executing getOR() query with data', queryData);
			if (!entries.length) return [];
			const rows = await this.rows();
			return rows.map((row) => this.Generator(row)).filter(satisfies);
		};

		const paginateQuery = async (page: number, size: number) => {
			this.log(
				`Executing getOR() paginated query for page ${page} with size ${size} and data`,
				queryData
			);
			const rows = (await allQuery()).map((item) => item.raw);
			const from = Math.max(0, (page - 1) * size);
			const to = from + size;
			const pageRows = rows.slice(from, to);
			return {
				data: pageRows.map((row) => this.Generator(row)),
				count: rows.length
			};
		};

		const query = new DexieQuery(this, satisfies, allQuery, paginateQuery);
		return query;
	}

	search(query: SearchQuery<Name, Schema>) {
		const evaluate = (row: Row<Name, Schema>, q: SearchQuery<Name, Schema>): boolean => {
			if ('field' in q) {
				return this.evaluateOp(q.operator, row[q.field], q.value);
			}
			if (q.type === 'and') {
				return q.conditions.every((cond) => evaluate(row, cond));
			}
			return q.conditions.some((cond) => evaluate(row, cond));
		};

		const satisfies = (data: DexieData<Name, Schema>) => evaluate(data.raw, query);

		const allQuery = async () => {
			this.log('Executing search() query with query', query);
			const rows = await this.rows();
			return rows.map((row) => this.Generator(row)).filter(satisfies);
		};

		const paginateQuery = async (page: number, size: number) => {
			this.log(
				`Executing search() paginated query for page ${page} with size ${size} and query`,
				query
			);
			const rows = (await allQuery()).map((item) => item.raw);
			const from = Math.max(0, (page - 1) * size);
			const to = from + size;
			const pageRows = rows.slice(from, to);
			return {
				data: pageRows.map((row) => this.Generator(row)),
				count: rows.length
			};
		};

		const result = new DexieQuery(this, satisfies, allQuery, paginateQuery);
		return result;
	}

	fromId(id: string): ResultPromise<DexieData<Name, Schema> | undefined> {
		return attemptAsync(async () => {
			await _init();
			const fromCache = this.cache.get(id);
			if (fromCache) return fromCache;
			const row = await this.tableDef().get(id);
			if (!row) {
				return undefined;
			}
			return this.Generator(row);
		});
	}

	fromIds(ids: string[]) {
		const satisfies = (data: DexieData<Name, Schema>) => ids.includes(data.id);

		const allQuery = async () => {
			this.log('Executing fromIds() query with ids', ids);
			const rows = await this.rows();
			return rows.map((row) => this.Generator(row)).filter(satisfies);
		};

		const paginateQuery = async (page: number, size: number) => {
			this.log(
				`Executing fromIds() paginated query for page ${page} with size ${size} and ids`,
				ids
			);
			const rows = (await allQuery()).map((item) => item.raw);
			const from = Math.max(0, (page - 1) * size);
			const to = from + size;
			const pageRows = rows.slice(from, to);
			return {
				data: pageRows.map((row) => this.Generator(row)),
				count: rows.length
			};
		};

		const result = new DexieQuery(this, satisfies, allQuery, paginateQuery);
		return result;
	}

	new(data: Insert<Schema>): ResultPromise<DexieData<Name, Schema>> {
		return attemptAsync(async () => {
			if (!data.id || !data.id.length) {
				throw new Error('Data must have a valid id for creation');
			}
			this.log('Creating new row with data', data);
			await _init();
			const now = new Date();
			const row: Row<Name, Schema> = {
				...(data as object),
				created_at: this.ensureDate(data.created_at, now)
			} as Row<Name, Schema>;
			await this.tableDef().add(row);
			return this.Generator(row);
		});
	}

	bulkNew(data: Insert<Schema>[]): ResultPromise<DexieData<Name, Schema>[]> {
		return attemptAsync(async () => {
			for (const item of data) {
				if (!item.id || !item.id.length) {
					throw new Error('All data items must have a valid id for creation');
				}
			}
			this.log('Creating new rows with data', data);
			await _init();
			const now = new Date();
			const rows: Row<Name, Schema>[] = data.map(
				(item) =>
					({
						...(item as object),
						created_at: this.ensureDate(item.created_at, now).toISOString()
					}) as Row<Name, Schema>
			);
			await this.tableDef().bulkAdd(rows);
			return rows.map((row) => this.Generator(row));
		});
	}

	upsert(data: Insert<Schema>): ResultPromise<DexieData<Name, Schema>> {
		return attemptAsync(async () => {
			if (!data.id || !data.id.length) {
				throw new Error('Data must have a valid id for upsert');
			}
			this.log('Upserting row with data', data);
			await _init();
			const now = new Date();
			const existing = await this.tableDef().get(data.id);
			const merged = {
				...(existing ?? {}),
				...(data as object),
				created_at: this.ensureDate(data.created_at, existing?.created_at ?? now).toISOString()
			} as Row<Name, Schema>;
			await this.tableDef().put(merged);
			return this.Generator(merged);
		});
	}

	bulkUpsert(data: Insert<Schema>[]): ResultPromise<DexieData<Name, Schema>[]> {
		return attemptAsync(async () => {
			this.log('Bulk upserting rows with data', data);
			await _init();
			const now = new Date();
			const rows: Row<Name, Schema>[] = [];
			for (const item of data) {
				if (!item.id || !item.id.length) {
					throw new Error('All data items must have a valid id for upsert');
				}
				const existing = await this.tableDef().get(item.id);
				const merged = {
					...(existing ?? {}),
					...(item as object),
					created_at: this.ensureDate(item.created_at, existing?.created_at ?? now).toISOString()
				} as Row<Name, Schema>;
				rows.push(merged);
			}
			await this.tableDef().bulkPut(rows);
			return rows.map((row) => this.Generator(row));
		});
	}

	private remove(id: string) {
		this.log('Removing row with id', id);
		this.cache.delete(id);

		// delete from indexdb
		return _init().then((db) => {
			db.table(this.config.name).delete(id);
		});
	}

	clear() {
		return attemptAsync(async () => {
			this.log('Clearing all rows and cache');
			await _init();
			await this.tableDef().clear();
			this.cache.clear();
		});
	}

	delete_by_ids(ids: string[]) {
		return attemptAsync(async () => {
			this.log('Deleting rows with ids', ids);
			await _init();
			await this.tableDef().bulkDelete(ids);
			for (const id of ids) {
				this.cache.delete(id);
			}
		});
	}
}

export class DexieQuery<Name extends string, Schema extends z.ZodTypeAny> {
	constructor(
		private readonly table: DexieTable<Name, Schema>,
		private readonly satisfies: (data: DexieData<Name, Schema>) => boolean,
		private readonly fetchAll: () => Promise<DexieData<Name, Schema>[]>,
		private readonly paginateQuery: (
			page: number,
			size: number
		) => Promise<PaginatedResponse<DexieData<Name, Schema>>>
	) {}

	get reactive() {
		return Array.from(this.table.cache.values()).filter(this.satisfies).sort(this._sort);
	}

	private log(...args: unknown[]) {
		this.table['log']('[DexieQuery]', ...args);
	}

	private _sort = (a: DexieData<Name, Schema>, b: DexieData<Name, Schema>) => {
		const aTime = a.created_at.getTime();
		const bTime = b.created_at.getTime();
		return aTime - bTime;
	};

	sort(fn: (a: DexieData<Name, Schema>, b: DexieData<Name, Schema>) => number) {
		this._sort = fn;
		return this;
	}

	then(
		onfulfilled?:
			((value: Result<DexieData<Name, Schema>[], Error>) => void | PromiseLike<void>) | null
	) {
		return this.fetchAll()
			.then((res) => {
				this.log('Fetched query results', res);
				const result = new Ok(res.sort(this._sort));
				onfulfilled?.(result);
				return result;
			})
			.catch((err) => {
				this.log('Error fetching query results', err);
				const result = new Err(err instanceof Error ? err : new Error(String(err))) as Result<
					DexieData<Name, Schema>[],
					Error
				>;
				onfulfilled?.(result);
				return result;
			});
	}

	unwrap() {
		return this.then().then((res) => res.unwrap());
	}

	unwrapOr(defaultValue: DexieData<Name, Schema>[]) {
		return this.then().then((res) => res.unwrapOr(defaultValue));
	}

	first() {
		return attemptAsync(async () => {
			const all = await this.fetchAll();
			return all.length ? all[0] : undefined;
		});
	}
}

export class DexieData<Name extends string, Schema extends z.ZodTypeAny> {
	public readonly raw: Row<Name, Schema> = {} as Row<Name, Schema>;

	constructor(
		public readonly table: DexieTable<Name, Schema>,
		data: Row<Name, Schema>
	) {
		this.raw = data;
	}

	get id() {
		return this.raw.id;
	}

	get created_at() {
		return new Date(this.raw.created_at);
	}

	get archived() {
		const value = (this.raw as Record<string, unknown>).archived;
		return typeof value === 'boolean' ? value : undefined;
	}

	private log(...args: unknown[]) {
		this.table['log'](`[Data:${this.id}]`, ...args);
	}

	update(updates: Update<Schema>) {
		return attemptAsync(async () => {
			this.log('Updating row with id', this.id, 'with updates', updates);
			await _init();
			const next = {
				...this.raw,
				...(updates as Partial<Row<Name, Schema>>)
			} as Row<Name, Schema>;
			await this.table['tableDef']().put(next);
			Object.assign(this.raw, next);
			return this;
		});
	}

	delete() {
		return attemptAsync(async () => {
			await _init();
			await this.table['tableDef']().delete(this.id);
			this.table['remove'](this.id);
			return true;
		});
	}
}

export type TableDataArr<Name extends string, Schema extends z.ZodTypeAny> = DexieQuery<
	Name,
	Schema
>;
