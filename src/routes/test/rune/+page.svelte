<script lang="ts">
	import { onMount } from 'svelte';
	import {
		TestStruct,
		type TestQuery,
		type TestItem,
		type SearchQuery,
		type LocalRow
	} from '$lib/services/test-struct.svelte';

	type TestRow = LocalRow & {
		name: string;
		email: string;
		role: 'user' | 'admin' | 'editor';
		age: number;
	};

	const makeSeed = (count = 27): TestRow[] =>
		Array.from({ length: count }, (_, i) => ({
			id: `seed-${i + 1}`,
			created_at: new Date(Date.now() - i * 86_400_000).toISOString(),
			archived: i % 5 === 0,
			name: `User ${i + 1}`,
			email: `user${i + 1}@local.test`,
			role: (i % 3 === 0 ? 'admin' : i % 3 === 1 ? 'editor' : 'user') as TestRow['role'],
			age: 18 + (i % 30),
		}));

	const initialSeed = makeSeed();

	const struct = TestStruct.get<TestRow>({
		schema: 'local',
		table: 'rune-playground',
		seed: initialSeed,
		debug: false,
	});

	let mode = $state<'all' | 'get' | 'getOR' | 'search'>('all');
	let roleFilter = $state<TestRow['role'] | ''>('');
	let archivedFilter = $state<'all' | 'true' | 'false'>('all');
	let searchText = $state('');
	let pageSize = $state(10);

	let activeQuery = $state<TestQuery<TestRow>>(struct.all());
	let pageRows = $state<TestItem<TestRow>[]>([]);
	let errorText = $state('');
	let infoText = $state('Ready');

	let createName = $state('');
	let createEmail = $state('');
	let createRole = $state<TestRow['role']>('user');
	let createAge = $state(21);
	let createArchived = $state(false);

	const boolFromSelect = (value: 'all' | 'true' | 'false') => {
		if (value === 'true') return true;
		if (value === 'false') return false;
		return undefined;
	};

	const buildQuery = () => {
		const archived = boolFromSelect(archivedFilter);
		const andQuery: Partial<TestRow> = {};

		if (roleFilter) andQuery.role = roleFilter;
		if (archived !== undefined) andQuery.archived = archived;

		if (mode === 'all') return struct.all();
		if (mode === 'get') return struct.get(andQuery);
		if (mode === 'getOR') return struct.getOR(andQuery);

		const q: SearchQuery<TestRow> = searchText.trim()
			? {
				  type: 'or',
				  conditions: [
					  { field: 'name', operator: 'ilike', value: searchText },
					  { field: 'email', operator: 'ilike', value: searchText },
				  ],
			  }
			: { field: 'archived', operator: 'eq', value: false };

		return struct.search(q);
	};

	const refreshPage = async () => {
		errorText = '';
		activeQuery = buildQuery();
		activeQuery.paginated.pageSize = pageSize;
		const result = await activeQuery.paginated.page(1);
		if (result.isErr()) {
			errorText = result.error.message;
			pageRows = [];
			return;
		}
		pageRows = result.value;
		infoText = `Loaded ${result.value.length} rows`;
	};

	const goPage = async (page: number) => {
		errorText = '';
		const result = await activeQuery.paginated.page(page);
		if (result.isErr()) {
			errorText = result.error.message;
			return;
		}
		pageRows = result.value;
	};

	const createRow = async () => {
		errorText = '';
		const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
		const result = await struct.new({
			id,
			name: createName || 'Unnamed',
			email: createEmail || `${id}@local.test`,
			role: createRole,
			age: Number(createAge) || 0,
			archived: createArchived,
		});
		if (result.isErr()) {
			errorText = result.error.message;
			return;
		}
		createName = '';
		createEmail = '';
		createAge = 21;
		createArchived = false;
		infoText = `Created ${result.value.id}`;
		await refreshPage();
	};

	const updateRow = async (item: TestItem<TestRow>) => {
		errorText = '';
		const result = await item.update({
			archived: item.data.archived,
			role: item.data.role,
			age: Number(item.data.age),
			name: String(item.data.name),
			email: String(item.data.email),
		});
		if (result.isErr()) {
			errorText = result.error.message;
			return;
		}
		infoText = `Updated ${item.id}`;
		await refreshPage();
	};

	const deleteRow = async (item: TestItem<TestRow>) => {
		errorText = '';
		const result = await item.delete();
		if (result.isErr()) {
			errorText = result.error.message;
			return;
		}
		infoText = `Deleted ${item.id}`;
		await refreshPage();
	};

	const clearAll = async () => {
		errorText = '';
		for (const id of Array.from(struct.cache.keys())) {
			struct.remove(id);
		}
		infoText = 'Cleared all local rows';
		await refreshPage();
	};

	const resetSeed = async () => {
		errorText = '';
		for (const id of Array.from(struct.cache.keys())) {
			struct.remove(id);
		}
		for (const row of initialSeed) {
			struct.Generator({ ...row });
		}
		infoText = `Reset to ${initialSeed.length} seed rows`;
		await refreshPage();
	};

	onMount(() => {
		void refreshPage();
	});
</script>

<section class="wrap">
	<h1>Local Struct CRUD Playground</h1>
	<p>Test list rendering, mutations, filtering, and pagination without Supabase.</p>

	<div class="panel controls">
		<label>
			Mode
			<select bind:value={mode} onchange={refreshPage}>
				<option value="all">all</option>
				<option value="get">get (AND)</option>
				<option value="getOR">getOR</option>
				<option value="search">search</option>
			</select>
		</label>

		<label>
			Role
			<select bind:value={roleFilter} onchange={refreshPage}>
				<option value="">any</option>
				<option value="user">user</option>
				<option value="editor">editor</option>
				<option value="admin">admin</option>
			</select>
		</label>

		<label>
			Archived
			<select bind:value={archivedFilter} onchange={refreshPage}>
				<option value="all">all</option>
				<option value="true">true</option>
				<option value="false">false</option>
			</select>
		</label>

		<label>
			Search Text
			<input bind:value={searchText} placeholder="name/email" oninput={refreshPage} />
		</label>

		<label>
			Page Size
			<input type="number" min="1" max="100" bind:value={pageSize} onchange={refreshPage} />
		</label>
	</div>

	<div class="panel create">
		<h2>Create Row</h2>
		<div class="row">
			<input bind:value={createName} placeholder="name" />
			<input bind:value={createEmail} placeholder="email" />
			<select bind:value={createRole}>
				<option value="user">user</option>
				<option value="editor">editor</option>
				<option value="admin">admin</option>
			</select>
			<input type="number" min="0" bind:value={createAge} />
			<label class="check"><input type="checkbox" bind:checked={createArchived} /> archived</label>
			<button onclick={createRow}>Create</button>
		</div>
	</div>

	<div class="status">
		<span>{infoText}</span>
		{#if errorText}<span class="error">{errorText}</span>{/if}
	</div>

	<div class="panel tools">
		<h2>Tools</h2>
		<div class="row">
			<button onclick={resetSeed}>Reset Seed</button>
			<button class="danger" onclick={clearAll}>Clear All</button>
		</div>
	</div>

	<div class="panel table">
		<table>
			<thead>
				<tr>
					<th>id</th>
					<th>name</th>
					<th>email</th>
					<th>role</th>
					<th>age</th>
					<th>archived</th>
					<th>created</th>
					<th>actions</th>
				</tr>
			</thead>
			<tbody>
				{#each pageRows as item (item.id)}
					<tr>
						<td>{item.id}</td>
						<td><input bind:value={item.data.name} /></td>
						<td><input bind:value={item.data.email} /></td>
						<td>
							<select bind:value={item.data.role}>
								<option value="user">user</option>
								<option value="editor">editor</option>
								<option value="admin">admin</option>
							</select>
						</td>
						<td><input type="number" bind:value={item.data.age} /></td>
						<td><input type="checkbox" bind:checked={item.data.archived} /></td>
						<td>{item.created.toLocaleString()}</td>
						<td class="actions">
							<button onclick={() => updateRow(item)}>Save</button>
							<button class="danger" onclick={() => deleteRow(item)}>Delete</button>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<div class="panel pager">
		<button onclick={() => goPage(1)} disabled={activeQuery.paginated.currentPage === 1}>First</button>
		<button onclick={() => goPage(activeQuery.paginated.currentPage - 1)} disabled={!activeQuery.paginated.hasPrev}>Prev</button>
		<span>
			Page {activeQuery.paginated.currentPage} / {activeQuery.paginated.pages}
			({activeQuery.paginated.totalItems} total)
		</span>
		<button onclick={() => goPage(activeQuery.paginated.currentPage + 1)} disabled={!activeQuery.paginated.hasNext}>Next</button>
		<button onclick={() => goPage(activeQuery.paginated.pages)} disabled={activeQuery.paginated.currentPage === activeQuery.paginated.pages}>Last</button>
	</div>
</section>

<style>
	:global(body) {
		font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif;
	}
	.wrap {
		max-width: 1200px;
		margin: 2rem auto;
		padding: 0 1rem 3rem;
	}
	h1 {
		margin: 0;
		font-size: 2rem;
	}
	p {
		margin-top: 0.5rem;
		color: #4f5b67;
	}
	.panel {
		margin-top: 1rem;
		padding: 1rem;
		border-radius: 12px;
		background: linear-gradient(180deg, #ffffff, #f4f7fb);
		border: 1px solid #d4dde8;
	}
	.controls {
		display: grid;
		gap: 0.75rem;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
	}
	label {
		display: grid;
		gap: 0.35rem;
		font-size: 0.85rem;
		color: #2e3b47;
	}
	input, select, button {
		font: inherit;
	}
	input, select {
		padding: 0.45rem 0.6rem;
		border: 1px solid #c2cfde;
		border-radius: 8px;
		background: white;
	}
	button {
		padding: 0.45rem 0.75rem;
		border: 1px solid #8aa1bb;
		border-radius: 8px;
		background: #e7f0fa;
		cursor: pointer;
	}
	button.danger {
		background: #ffecec;
		border-color: #d39b9b;
	}
	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.create .row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
		gap: 0.5rem;
		align-items: center;
	}
	.check {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.status {
		margin-top: 0.75rem;
		display: flex;
		gap: 1rem;
		align-items: center;
		color: #22313f;
		font-size: 0.9rem;
	}
	.error {
		color: #c03a3a;
	}
	.table {
		overflow-x: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
	}
	th, td {
		border-bottom: 1px solid #d5e0ec;
		padding: 0.5rem;
		text-align: left;
		vertical-align: middle;
		white-space: nowrap;
	}
	.actions {
		display: flex;
		gap: 0.35rem;
	}
	.pager {
		display: flex;
		gap: 0.6rem;
		align-items: center;
		flex-wrap: wrap;
	}
</style>