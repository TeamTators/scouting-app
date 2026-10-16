---
name: supastruct
description: "Use when: working with typed Supabase data access, adding a new table query for the app, fixing a SupaStruct cache/realtime issue, or wiring a new schema/table into the project's SupaStruct system in src/lib/services/supabase/supastruct.svelte.ts"
---

# SupaStruct workflow

This skill covers the repo's typed Supabase data access layer built around `SupaStruct`, `SupaStructData`, `SupaQuery`, and the cached Dexie + realtime integration in [src/lib/services/supabase/supastruct.svelte.ts](../../../src/lib/services/supabase/supastruct.svelte.ts).

Use this workflow whenever you need to:

- create a typed data access layer for a Supabase table
- build a query for a schema/table pair
- debug a cache or realtime sync issue
- read a row, filter rows, search rows, paginate rows, or subscribe to live changes
- work with typed row wrappers instead of raw DB objects

## The core rule: every query is a `SupaQuery`

The important distinction in this system is:

- `SupaStruct` = table adapter + config + cache + schema metadata
- `SupaQuery` = the actual query builder and execution flow
- `SupaStructData` = hydrated row wrapper around a raw row

Queries are not just raw Supabase calls. They go through a pipeline:

1. Create or reuse a table struct with `SupaStruct.get({ schema, table, client, ... })`
2. Call `get(...)`, `search(...)`, `fromId(...)`, `all()`, or `join(...)`
3. The call creates a `SupaQuery` instance with filters and required fields
4. `SupaQuery.build()` creates the underlying Supabase query builder
5. Every query automatically adds `filter('archived', 'eq', false)`
6. Data is hydrated into `SupaStructData` wrappers via `Hydrate()`
7. The result is available as `reactive`, `fetch_all()`, `first()`, `last()`, `count()`, or `paginated.page(...)`

Important: do not manually add `archived` to the query filters. That is already added automatically on every query in this repo.

## Critical behavior to know

### 1. `archived` is always injected

In the actual implementation, `SupaQuery.build()` does this before any conditions are applied:

```ts
const query = this.struct.supabase
	.schema(this.struct.schema)
	.from(this.struct.table)
	.select(to_select, { count })
	.filter('archived', 'eq', false);
```

That means:

- all normal reads exclude archived rows by default
- when writing filters, use only the active business conditions
- `archived` is not part of the logic you should manually manage unless you are intentionally dealing with a special case in a bespoke query
- `archived` is really just a system-level filter to exclude soft-deleted rows by admins and should not be manipulated in normal query logic

### 2. Query filters are encoded as search trees

The filter system accepts a recursive `SearchQuery` shape like:

```ts
{
  type: 'and',
  conditions: [
    { field: 'status', operator: 'eq', value: 'active' },
    { field: 'name', operator: 'ilike', value: '%alex%' }
  ]
}
```

or a single condition:

```ts
{ field: 'id', operator: 'eq', value: 'abc-123' }
```

Supported operators in the runtime include:

- `eq`, `neq`
- `gt`, `lt`, `gte`, `lte`
- `like`, `ilike`
- `in`

The `matches_filter()` method on `SupaQuery` evaluates those conditions against the hydrated row object, which is why you can filter by either raw row values or typed row fields through `data.raw[...]`.

### 3. `get(...)` is not a raw database query; it creates a `SupaQuery`

This is the main workflow:

```ts
const ProfileStruct = SupaStruct.get({
	schema: 'core',
	table: 'profile',
	client: supabase
});

const query = ProfileStruct.get({ role: 'admin' });
const rows = await query.fetch_all();
```

Inside `get(...)`, the code turns the object payload into a set of equality conditions and then creates a `new SupaQuery(this, search, required)`.

That means the query is designed to support:

- `reactive` result access
- `fetch_all()`
- `fetch_paginated(page, size)` via `paginated.page(...)`
- `first()`, `last()`, `count()`
- `subscribe()` for realtime event updates
- `sort()`, `reverse()`, and `filter()` on the query wrapper

### 4. Hydration always wraps data in `SupaStructData`

The `Hydrate()` method is the normalization boundary.

It does three things:

- validates the incoming row payload
- reuses cached row instances when possible
- returns stable `SupaStructData` instances instead of raw objects

This is why downstream code usually works with `row.raw` and typed wrapper props, not loose plain objects.

### 5. Realtime and cache are first-class parts of the query system

The repository does not treat realtime as an afterthought. `SupaQuery` supports:

- `subscribe(callback)` for live updates
- Dexie pull-through caching
- `sync(ttl)` for cache freshness logic
- `reactive` for in-memory view updates

The realtime filter is built with `postgresChangesFilter()` and the query filter tree, and the query is automatically bound to the table’s schema + table + filter key.

## Core pattern

1. Resolve the table and schema before writing queries.
   - Look up the generated Supabase types and Zod schemas for the target table.
   - Use the schema name + table name together, not a loose table string.
   - Prefer the singleton factory `SupaStruct.get(...)` so the app reuses one cache and one in-memory registry instance per table.

2. Construct a typed struct with the required runtime config.

   ```ts
   const ProfileStruct = SupaStruct.get({
   	schema: 'core',
   	table: 'profile',
   	client: supabase,
   	debug: false,
   	index_db: true
   });
   ```

3. Choose the right query primitive for the use case.
   - `fromId(id)` for a direct row lookup
   - `get(filters)` for AND-style equality filters
   - `getOR(...)` for OR-style lookups built from a filter object
   - `search({ type, conditions })` for nested condition trees and more advanced comparisons
   - `all()` for full table reads when appropriate
   - `join(otherStruct, ...)` for relational queries
   - `paginated.page(page, size)` when you need paging
   - `first()`, `last()`, `count()`, and `subscribe()` for query-specific behavior

4. Work with `SupaStructData` wrappers, not plain raw objects.
   - Use `row.raw` for the persisted DB payload
   - Use `row.id`, `row.created_at`, and other typed fields as needed
   - Treat `raw` as the canonical DB-backed shape and keep mutations through the struct API

5. Mutate through the struct, not ad hoc `supabase.from(...).update(...)` calls.
   - `new(...)` for inserts
   - `upsert(...)` for save/update semantics
   - `update(...)` / instance update flows when available on wrapped rows
   - `remove(...)` or archive patterns when the project uses soft delete semantics
   - Preserve `id` and `created_at` conventions required by the table contract

6. Preserve cache and realtime behavior.
   - Reuse the same struct instance for a schema/table pair
   - Keep `do_set` enabled unless you intentionally want a transient struct
   - If a test or highly temporary flow does not need Dexie persistence, disable `index_db` explicitly

## Query-building examples

### Simple equality lookup

```ts
const activeProfiles = ProfileStruct.get({
	role: 'admin'
});

const rows = await activeProfiles; // queries are promise-like

// however in this app, you can treat the query result as a reactive svelte rune
const reactiveRows = $derived(activeProfiles.reactive); // reactive store with live updates, cache first, and automatic invalidation
```

This is converted into an equality filter tree and then executed through `SupaQuery.build()`; `archived = false` is added automatically before the query runs.

### Search with compound conditions

```ts
const matches = await ProfileStruct.search({
	type: 'and',
	conditions: [
		{ field: 'name', operator: 'ilike', value: '%alex%' },
		{ field: 'created_at', operator: 'gte', value: '2024-01-01' }
	]
}).fetch_all();
```

### Pagination

```ts
const page = await ProfileStruct.get({ role: 'admin' }).paginated.page(1, 25);
console.log(page.data.length, page.count);
```

### First/last value

```ts
const newest = await ProfileStruct.get({ role: 'admin' }).last();
const oldest = await ProfileStruct.get({ role: 'admin' }).first();
```

### Realtime subscription

```ts
const unsub = ProfileStruct.get({ status: 'active' }).subscribe((row, event) => {
	console.log('event', event, row.id);
});
```

## Decision points

### When to use `SupaStruct.get(...)`

Use it whenever you need a reusable table adapter. Do not create a new struct for each component render unless you intentionally want isolation.

### When to use `get(...)` vs `search(...)`

- Use `get(...)` for straightforward equality/hash-style filters.
- Use `search(...)` for conditions, ranges, partial matches, OR/AND logic, or PostgREST-like operators such as `ilike`, `gte`, `lte`, and `contains`.
- In this app, the query engine is built around the `SearchQuery` tree, so even simple filters eventually become a structured condition tree.

### When to use `index_db`

- Enable it for normal app behavior to keep the offline cache warm.
- Disable it in isolated tests or temporary data fixtures when you do not want persistence noise.

### When to use `serviceRole`

- Only use a privileged client when server-side admin access is required.
- Keep standard UI patterns on the regular client with permission-aware, typed queries.

## Quality checklist

Before considering a change complete, verify:

- the table is configured with the correct `schema` and `table`
- the query is created from the shared `SupaStruct.get(...)` singleton
- the query respects the default `archived = false` behavior and does not reintroduce archived rows manually
- data is consumed as `SupaStructData` where appropriate, not as a raw loose object
- `Result` handling is respected (`isErr()`, `unwrap()`, etc.)
- filters still respect the app's active row semantics
- no duplicate or conflicting struct instances were created for the same table
- offline/local caching is intentionally enabled or disabled
- type errors are gone for the target schema/table pair

## Anti-patterns to avoid

- Creating ad hoc `supabase.from().select()` calls instead of using the struct layer
- Recreating the same table struct repeatedly in component code
- Ignoring `Result` objects and assuming success
- Reading raw `row` values without checking the wrapper API and `raw` payload shape
- Manually re-adding `archived` filters to every query
- Forgetting that the query system adds `archived = false` automatically in `build()`
- Disabling cache behavior without a clear reason in production flows

## Related project files

- [src/lib/services/supabase/supastruct.svelte.ts](../../../src/lib/services/supabase/supastruct.svelte.ts)
- [src/lib/services/db/table.ts](../../../src/lib/services/db/table.ts)
- [src/routes/test/supabase/+page.svelte](../../../src/routes/test/supabase/+page.svelte)
- [src/tests/crud.test.ts](../../../src/tests/crud.test.ts)

## Typical prompt starter

Use this skill with prompts like:

- "Create a typed SupaStruct query for the profile table with role=admin."
- "Fix this SupaStruct cache issue and keep the shared singleton pattern."
- "Add a search query for the session table with two compound conditions and proper Result handling."
- "Use the app's SupaStruct client to insert a row and return the typed wrapper."
