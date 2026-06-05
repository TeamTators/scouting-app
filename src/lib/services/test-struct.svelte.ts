import { attemptAsync, ComplexEventEmitter, type Result, Ok, Err } from 'ts-utils';
import { SvelteDate, SvelteMap } from 'svelte/reactivity';

export type LocalRow = {
    id: string;
    created_at: string;
    archived: boolean;
    [key: string]: unknown;
};

export type SearchQuery<T extends LocalRow> =
    | {
            field: keyof T;
            operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike';
            value: T[keyof T];
      }
    | {
            type: 'and' | 'or';
            conditions: SearchQuery<T>[];
      };

type PaginatedResponse<T> = { data: T[]; count: number };

export type TestStructConfig<T extends LocalRow> = {
    table?: string;
    schema?: string;
    debug?: boolean;
    seed?: T[];
};

export class TestStruct<T extends LocalRow> {
    public static readonly structs = new SvelteMap<string, TestStruct<LocalRow>>();

    public static get<T extends LocalRow>(config: TestStructConfig<T> = {}): TestStruct<T> {
        const table = config.table ?? 'local';
        const schema = config.schema ?? 'local';
        const key = `${schema}:${table}`;
        const existing = TestStruct.structs.get(key);
        if (existing) {
            return existing as unknown as TestStruct<T>;
        }
        const struct = new TestStruct<T>(config);
        TestStruct.structs.set(key, struct as unknown as TestStruct<LocalRow>);
        return struct;
    }

    public readonly cache = $state(new SvelteMap<string, TestItem<T>>());
    private readonly queryCache = $state(new SvelteMap<string, TestQuery<T>>());
    private readonly em = new ComplexEventEmitter<{
        new: [TestItem<T>];
        update: [TestItem<T>, T];
        delete: [TestItem<T>];
    }>();

    constructor(private readonly config: TestStructConfig<T> = {}) {
        for (const row of config.seed ?? []) {
            this.Generator(row);
        }
    }

    get table() {
        return this.config.table ?? 'local';
    }

    get schema() {
        return this.config.schema ?? 'local';
    }

    log(...args: unknown[]) {
        if (this.config.debug) {
            console.log(`[TestStruct:${this.table}]`, ...args);
        }
    }

    initRealtime() {
        // Local-only mode: no remote channel, return cleanup callback for API parity.
        return () => undefined;
    }

    private validate(data: Partial<T> & { id?: unknown }): T {
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid row data');
        }
        const id = String(data.id ?? '');
        if (!id) {
            throw new Error('Local row requires an id');
        }
        const createdAt = typeof data.created_at === 'string' ? data.created_at : new SvelteDate().toISOString();
        const archived = typeof data.archived === 'boolean' ? data.archived : false;
        return {
            ...(data as T),
            id,
            created_at: createdAt,
            archived,
        } as T;
    }

    Generator(row: T): TestItem<T> {
        const validated = this.validate(row);
        const existing = this.cache.get(validated.id);
        if (existing) {
            Object.assign(existing.data as T, validated);
            this.em.emit('update', existing, validated);
            return existing;
        }

        const wrapped = new TestItem<T>(this, validated);
        this.cache.set(validated.id, wrapped);
        this.em.emit('new', wrapped);
        return wrapped;
    }

    private toRows() {
        return Array.from(this.cache.values());
    }

    private static evalPredicate<T extends LocalRow>(item: TestItem<T>, query: SearchQuery<T>): boolean {
        if ('field' in query) {
            const fieldValue = item.data[query.field];
            switch (query.operator) {
                case 'eq':
                    return fieldValue === query.value;
                case 'neq':
                    return fieldValue !== query.value;
                case 'gt':
                    return (fieldValue as number | string) > (query.value as number | string);
                case 'gte':
                    return (fieldValue as number | string) >= (query.value as number | string);
                case 'lt':
                    return (fieldValue as number | string) < (query.value as number | string);
                case 'lte':
                    return (fieldValue as number | string) <= (query.value as number | string);
                case 'like':
                    return typeof fieldValue === 'string' && typeof query.value === 'string' && fieldValue.includes(query.value);
                case 'ilike':
                    return typeof fieldValue === 'string' && typeof query.value === 'string' && fieldValue.toLowerCase().includes(query.value.toLowerCase());
                default:
                    return false;
            }
        }

        if (query.type === 'and') {
            return query.conditions.every((q) => TestStruct.evalPredicate(item, q));
        }
        return query.conditions.some((q) => TestStruct.evalPredicate(item, q));
    }

    private makePaginated(data: TestItem<T>[], page: number, size: number): PaginatedResponse<TestItem<T>> {
        const from = (page - 1) * size;
        const to = from + size;
        return {
            data: data.slice(from, to),
            count: data.length,
        };
    }

    get(queryData: Partial<T>) {
        const cacheKey = `get:${JSON.stringify(queryData)}`;
        const cached = this.queryCache.get(cacheKey);
        if (cached) return cached;

        const satisfies = (data: TestItem<T>) =>
            Object.entries(queryData).every(([key, value]) => data.data[key as keyof T] === value);

        const allQuery = async () => this.toRows().filter(satisfies);
        const paginateQuery = async (page: number, size: number) => this.makePaginated((await allQuery()), page, size);

        const q = new TestQuery(this, satisfies, allQuery, paginateQuery);
        this.queryCache.set(cacheKey, q);
        return q;
    }

    getOR(queryData: Partial<T>) {
        const cacheKey = `getOR:${JSON.stringify(queryData)}`;
        const cached = this.queryCache.get(cacheKey);
        if (cached) return cached;

        const satisfies = (data: TestItem<T>) =>
            Object.entries(queryData).some(([key, value]) => data.data[key as keyof T] === value);

        const allQuery = async () => this.toRows().filter(satisfies);
        const paginateQuery = async (page: number, size: number) => this.makePaginated((await allQuery()), page, size);

        const q = new TestQuery(this, satisfies, allQuery, paginateQuery);
        this.queryCache.set(cacheKey, q);
        return q;
    }

    search(query: SearchQuery<T>) {
        const cacheKey = `search:${JSON.stringify(query)}`;
        const cached = this.queryCache.get(cacheKey);
        if (cached) return cached;

        const satisfies = (data: TestItem<T>) => TestStruct.evalPredicate(data, query);

        const allQuery = async () => this.toRows().filter(satisfies);
        const paginateQuery = async (page: number, size: number) => this.makePaginated((await allQuery()), page, size);

        const q = new TestQuery(this, satisfies, allQuery, paginateQuery);
        this.queryCache.set(cacheKey, q);
        return q;
    }

    all() {
        const cacheKey = 'all';
        const cached = this.queryCache.get(cacheKey);
        if (cached) return cached;

        const satisfies = (_: TestItem<T>) => true;
        const allQuery = async () => this.toRows();
        const paginateQuery = async (page: number, size: number) => this.makePaginated((await allQuery()), page, size);

        const q = new TestQuery(this, satisfies, allQuery, paginateQuery);
        this.queryCache.set(cacheKey, q);
        return q;
    }

    fromId(id: string) {
        return attemptAsync(async () => {
            const item = this.cache.get(id);
            if (!item) {
                throw new Error(`No row found with id ${id}`);
            }
            return item;
        });
    }

    new(data: Partial<T> & { id: string }) {
        return attemptAsync(async () => this.Generator(this.validate(data)));
    }

    upsert(data: Partial<T> & { id: string }) {
        return attemptAsync(async () => this.Generator(this.validate(data)));
    }

    remove(id: string) {
        const existing = this.cache.get(id);
        if (!existing) return false;
        this.cache.delete(id);
        this.em.emit('delete', existing);
        return true;
    }
}

export class TestQuery<T extends LocalRow> {
    private _paginatedInstance: TestPagination<T> | null = null;
    private _loading = $state(false);

    constructor(
        private readonly struct: TestStruct<T>,
        private readonly satisfies: (data: TestItem<T>) => boolean,
        private readonly fetchAll: () => Promise<TestItem<T>[]>,
        private readonly paginateQuery: (page: number, size: number) => Promise<PaginatedResponse<TestItem<T>>>
    ) {}

    get reactive() {
        return Array.from(this.struct.cache.values()).filter(this.satisfies);
    }

    get paginated() {
        if (!this._paginatedInstance) {
            this._paginatedInstance = new TestPagination(this, this.struct, this.paginateQuery);
        }
        return this._paginatedInstance;
    }

    then(
        onfulfilled?: ((value: Result<TestItem<T>[], Error>) => void | PromiseLike<void>) | null,
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
                const result = new Err(err instanceof Error ? err : new Error(String(err))) as Result<TestItem<T>[], Error>;
                onfulfilled?.(result);
                return result;
            });
    }
}

export class TestPagination<T extends LocalRow> {
    private _currentPage = $state(1);
    private _pageSize = $state(10);
    private _totalItems = $state(0);
    private _currentPageIds = $state<string[]>([]);

    constructor(
        private readonly _query: TestQuery<T>,
        private readonly struct: TestStruct<T>,
        private readonly paginateQuery: (page: number, size: number) => Promise<PaginatedResponse<TestItem<T>>>
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
        this.executeFetch();
    }

    get totalItems() {
        return this._totalItems;
    }

    get pages() {
        return Math.ceil(this._totalItems / this._pageSize) || 1;
    }

    get reactive(): TestItem<T>[] {
        return this._currentPageIds
            .map((id) => this.struct.cache.get(id))
            .filter((item): item is TestItem<T> => !!item);
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
                return new Err(err instanceof Error ? err : new Error(String(err))) as Result<TestItem<T>[], Error>;
            });
    }

    then(
        onfulfilled?: ((value: Result<TestItem<T>[], Error>) => void | PromiseLike<void>) | null,
    ) {
        return this.executeFetch().then(onfulfilled);
    }
}

export class TestItem<T extends LocalRow> {
    public readonly data = $state({} as T);

    constructor(
        private readonly struct: TestStruct<T>,
        initialData: T
    ) {
        this.data = initialData;
    }

    get id() {
        return this.data.id;
    }

    get created() {
        return new SvelteDate(this.data.created_at);
    }

    get archived() {
        return this.data.archived;
    }

    update(updates: Partial<T>) {
        return attemptAsync(async () => {
            Object.assign(this.data as T, updates);
            return this;
        });
    }

    delete() {
        return attemptAsync(async () => this.struct.remove(this.id));
    }
}