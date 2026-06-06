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
import { attemptAsync, type ResultPromise } from 'ts-utils/check';
import { Err, Ok, type Result } from 'ts-utils';
import { SvelteDate, SvelteMap } from 'svelte/reactivity';
import {
	_define,
	_init,
	type SchemaDefinition,
	type SchemaFieldReturnType,
	type TableStructable
} from '.';

export type Row<_Name extends string, Type extends SchemaDefinition> = TableStructable<Type>;

export type Insert<Type extends SchemaDefinition> = {
	[K in keyof Type]: SchemaFieldReturnType<Type[K]>;
} & Partial<{
	id: string;
	created_at: Date;
	updated_at: Date;
}>;

export type Update<Type extends SchemaDefinition> = Partial<Insert<Type>>;

export type SearchQuery<Name extends string, Type extends SchemaDefinition> =
	| {
			field: keyof Row<Name, Type>;
			operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike';
			value: Row<Name, Type>[keyof Row<Name, Type>];
	  }
	| {
			type: 'and' | 'or';
			conditions: SearchQuery<Name, Type>[];
	  };

type PaginatedResponse<T> = {
	data: T[];
	count: number;
};

export type TableConfig<Name extends string, Type extends SchemaDefinition> = {
	name: Name;
	schema: Type;
	debug?: boolean;
};

export class Table<Name extends string, Type extends SchemaDefinition> {
	public static readonly tables = new SvelteMap<string, Table<string, SchemaDefinition>>();

	public static get<Name extends string, Type extends SchemaDefinition>(
		config: TableConfig<Name, Type>
	) {
		const key = config.name;
		const existing = Table.tables.get(key);
		if (existing) {
			return existing as unknown as Table<Name, Type>;
		}
		const created = new Table(config);
		Table.tables.set(key, created as unknown as Table<string, SchemaDefinition>);
		return created;
	}

	public readonly cache = $state(new SvelteMap<string, TableData<Name, Type>>());
	private readonly queryCache = $state(new SvelteMap<string, TableQuery<Name, Type>>());
	private readonly tableDef: ReturnType<typeof _define<Type>>;

	constructor(private readonly config: TableConfig<Name, Type>) {
		this.tableDef = _define(config.name, config.schema);
	}

	private log(...args: unknown[]) {
		if (this.config.debug) {
			console.log(`[Table:${this.config.name}]`, ...args);
		}
	}

	private ensureDate(
		value: Date | SvelteDate | string | undefined,
		fallback: Date | SvelteDate = new SvelteDate()
	) {
		if (!value) return fallback;
		if (value instanceof Date) return value;
		return new SvelteDate(value);
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
		await _init();
		return this.tableDef().toArray();
	}

	Generator(row: Row<Name, Type>) {
		const has = this.cache.get(row.id);
		if (has) {
			Object.assign(has.raw, row);
			return has;
		}
		const created = new TableData(this, row);
		this.cache.set(row.id, created);
		return created;
	}

	all() {
		const cacheKey = 'all';
		const has = this.queryCache.get(cacheKey);
		if (has) return has;

		const satisfies = (_: TableData<Name, Type>) => true;

		const allQuery = async () => {
			const rows = await this.rows();
			return rows.map((row) => this.Generator(row));
		};

		const paginateQuery = async (page: number, size: number) => {
			const rows = await this.rows();
			const from = Math.max(0, (page - 1) * size);
			const to = from + size;
			const pageRows = rows.slice(from, to);
			return {
				data: pageRows.map((row) => this.Generator(row)),
				count: rows.length
			};
		};

		const query = new TableQuery(this, satisfies, allQuery, paginateQuery);
		this.queryCache.set(cacheKey, query);
		return query;
	}

	get(queryData: Partial<Row<Name, Type>>) {
		const cacheKey = `get:${JSON.stringify(queryData)}`;
		const has = this.queryCache.get(cacheKey);
		if (has) return has;

		const satisfies = (data: TableData<Name, Type>) =>
			Object.entries(queryData).every(
				([key, value]) => data.raw[key as keyof Row<Name, Type>] === value
			);

		const allQuery = async () => {
			const rows = await this.rows();
			return rows.map((row) => this.Generator(row)).filter(satisfies);
		};

		const paginateQuery = async (page: number, size: number) => {
			const rows = (await allQuery()).map((item) => item.raw);
			const from = Math.max(0, (page - 1) * size);
			const to = from + size;
			const pageRows = rows.slice(from, to);
			return {
				data: pageRows.map((row) => this.Generator(row)),
				count: rows.length
			};
		};

		const query = new TableQuery(this, satisfies, allQuery, paginateQuery);
		this.queryCache.set(cacheKey, query);
		return query;
	}

	getOR(queryData: Partial<Row<Name, Type>>) {
		const cacheKey = `getOR:${JSON.stringify(queryData)}`;
		const has = this.queryCache.get(cacheKey);
		if (has) return has;

		const entries = Object.entries(queryData);
		const satisfies = (data: TableData<Name, Type>) =>
			entries.some(([key, value]) => data.raw[key as keyof Row<Name, Type>] === value);

		const allQuery = async () => {
			if (!entries.length) return [];
			const rows = await this.rows();
			return rows.map((row) => this.Generator(row)).filter(satisfies);
		};

		const paginateQuery = async (page: number, size: number) => {
			const rows = (await allQuery()).map((item) => item.raw);
			const from = Math.max(0, (page - 1) * size);
			const to = from + size;
			const pageRows = rows.slice(from, to);
			return {
				data: pageRows.map((row) => this.Generator(row)),
				count: rows.length
			};
		};

		const query = new TableQuery(this, satisfies, allQuery, paginateQuery);
		this.queryCache.set(cacheKey, query);
		return query;
	}

	search(query: SearchQuery<Name, Type>) {
		const cacheKey = `search:${JSON.stringify(query)}`;
		const has = this.queryCache.get(cacheKey);
		if (has) return has;

		const evaluate = (row: Row<Name, Type>, q: SearchQuery<Name, Type>): boolean => {
			if ('field' in q) {
				return this.evaluateOp(q.operator, row[q.field], q.value);
			}
			if (q.type === 'and') {
				return q.conditions.every((cond) => evaluate(row, cond));
			}
			return q.conditions.some((cond) => evaluate(row, cond));
		};

		const satisfies = (data: TableData<Name, Type>) => evaluate(data.raw, query);

		const allQuery = async () => {
			const rows = await this.rows();
			return rows.map((row) => this.Generator(row)).filter(satisfies);
		};

		const paginateQuery = async (page: number, size: number) => {
			const rows = (await allQuery()).map((item) => item.raw);
			const from = Math.max(0, (page - 1) * size);
			const to = from + size;
			const pageRows = rows.slice(from, to);
			return {
				data: pageRows.map((row) => this.Generator(row)),
				count: rows.length
			};
		};

		const result = new TableQuery(this, satisfies, allQuery, paginateQuery);
		this.queryCache.set(cacheKey, result);
		return result;
	}

	fromId(id: string): ResultPromise<TableData<Name, Type>> {
		return attemptAsync(async () => {
			await _init();
			const fromCache = this.cache.get(id);
			if (fromCache) return fromCache;
			const row = await this.tableDef().get(id);
			if (!row) {
				throw new Error('Not found');
			}
			return this.Generator(row);
		});
	}

	new(...data: Insert<Type>[]): ResultPromise<TableData<Name, Type>> {
		return attemptAsync(async () => {
			await _init();
			if (!data.length) {
				throw new Error('No insert payload provided');
			}
			if (data.length > 1) {
				throw new Error('Only one insert payload is supported');
			}

			const row = data[0];
			const now = new SvelteDate();
			const id =
				typeof row.id === 'string' && row.id.length
					? row.id
					: (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);

			const toSave = {
				...(row as object),
				id,
				created_at: this.ensureDate(row.created_at, now),
				updated_at: this.ensureDate(row.updated_at, now)
			} as Row<Name, Type>;

			await this.tableDef().put(toSave);
			this.log('Inserted row', toSave);
			return this.Generator(toSave);
		});
	}

	upsert(data: Insert<Type>): ResultPromise<TableData<Name, Type>> {
		return attemptAsync(async () => {
			await _init();
			const now = new SvelteDate();
			const id =
				typeof data.id === 'string' && data.id.length
					? data.id
					: (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
			const existing = await this.tableDef().get(id);
			const merged = {
				...(existing ?? {}),
				...(data as object),
				id,
				created_at: this.ensureDate(data.created_at, existing?.created_at ?? now),
				updated_at: now
			} as Row<Name, Type>;
			await this.tableDef().put(merged);
			return this.Generator(merged);
		});
	}

	remove(id: string) {
		this.cache.delete(id);
	}

	clear() {
		return attemptAsync(async () => {
			await _init();
			await this.tableDef().clear();
			this.cache.clear();
		});
	}
}

export class TableQuery<Name extends string, Type extends SchemaDefinition> {
	private _paginatedInstance: TablePagination<Name, Type> | null = null;
	private _loading = $state(false);

	constructor(
		private readonly table: Table<Name, Type>,
		private readonly satisfies: (data: TableData<Name, Type>) => boolean,
		private readonly fetchAll: () => Promise<TableData<Name, Type>[]>,
		private readonly paginateQuery: (
			page: number,
			size: number
		) => Promise<PaginatedResponse<TableData<Name, Type>>>
	) {}

	get reactive() {
		return Array.from(this.table.cache.values()).filter(this.satisfies);
	}

	get paginated() {
		if (!this._paginatedInstance) {
			this._paginatedInstance = new TablePagination(this.table, this.paginateQuery);
		}
		return this._paginatedInstance;
	}

	then(
		onfulfilled?:
			| ((value: Result<TableData<Name, Type>[], Error>) => void | PromiseLike<void>)
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
					TableData<Name, Type>[],
					Error
				>;
				onfulfilled?.(result);
				return result;
			});
	}

	unwrap() {
		return this.then().then((res) => res.unwrap());
	}

	unwrapOr(defaultValue: TableData<Name, Type>[]) {
		return this.then().then((res) => res.unwrapOr(defaultValue));
	}
}

export class TablePagination<Name extends string, Type extends SchemaDefinition> {
	private _currentPage = $state(1);
	private _pageSize = $state(10);
	private _totalItems = $state(0);
	private _currentPageIds = $state<string[]>([]);

	constructor(
		private readonly table: Table<Name, Type>,
		private readonly paginateQuery: (
			page: number,
			size: number
		) => Promise<PaginatedResponse<TableData<Name, Type>>>
	) {}

	get currentPage() {
		return this._currentPage;
	}

	get pageSize() {
		return this._pageSize;
	}

	set pageSize(value: number) {
		this._pageSize = value;
		this._currentPage = 1;
		void this.executeFetch();
	}

	get totalItems() {
		return this._totalItems;
	}

	get pages() {
		return Math.ceil(this._totalItems / this._pageSize) || 1;
	}

	get reactive() {
		return this._currentPageIds
			.map((id) => this.table.cache.get(id))
			.filter((item): item is TableData<Name, Type> => !!item);
	}

	get hasNext() {
		return this._currentPage < this.pages;
	}

	get hasPrev() {
		return this._currentPage > 1;
	}

	next() {
		if (this.hasNext) {
			this._currentPage++;
			return this.executeFetch();
		}
		return Promise.resolve(new Ok([]));
	}

	prev() {
		if (this.hasPrev) {
			this._currentPage--;
			return this.executeFetch();
		}
		return Promise.resolve(new Ok([]));
	}

	page(num: number) {
		if (num >= 1 && num <= this.pages) {
			this._currentPage = num;
			return this.executeFetch();
		}
		return Promise.resolve(new Ok([]));
	}

	private executeFetch() {
		return this.paginateQuery(this._currentPage, this._pageSize)
			.then((res) => {
				this._totalItems = res.count;
				this._currentPageIds = res.data.map((item) => item.id);
				return new Ok(res.data);
			})
			.catch((err) => {
				return new Err(err instanceof Error ? err : new Error(String(err))) as Result<
					TableData<Name, Type>[],
					Error
				>;
			});
	}

	then(
		onfulfilled?:
			| ((value: Result<TableData<Name, Type>[], Error>) => void | PromiseLike<void>)
			| null
	) {
		return this.executeFetch().then(onfulfilled);
	}
}

export class TableData<Name extends string, Type extends SchemaDefinition> {
	public readonly raw: Row<Name, Type> = $state({} as Row<Name, Type>);

	constructor(
		public readonly table: Table<Name, Type>,
		data: Row<Name, Type>
	) {
		this.raw = data;
	}

	get id() {
		return this.raw.id;
	}

	get created() {
		return new SvelteDate(this.raw.created_at);
	}

	get archived() {
		const value = (this.raw as Record<string, unknown>).archived;
		return typeof value === 'boolean' ? value : undefined;
	}

	update(updates: Update<Type>) {
		return attemptAsync(async () => {
			await _init();
			const next = {
				...this.raw,
				...(updates as Partial<Row<Name, Type>>),
				updated_at: new SvelteDate()
			} as Row<Name, Type>;
			await this.table['tableDef']().put(next);
			Object.assign(this.raw, next);
			return this;
		});
	}

	delete() {
		return attemptAsync(async () => {
			await _init();
			await this.table['tableDef']().delete(this.id);
			this.table.remove(this.id);
			return true;
		});
	}
}

export type TableDataArr<Name extends string, Type extends SchemaDefinition> = TableQuery<
	Name,
	Type
>;
export type PaginatedTableData<
	Name extends string,
	Type extends SchemaDefinition
> = TablePagination<Name, Type>;
