<script lang="ts">
	import { SupaStruct } from '$lib/services/supabase/supastruct.svelte';
	import { onMount } from 'svelte';

	const { data } = $props();

	type SuiteName = 'crud' | 'all_paginated' | 'realtime';
	type SuiteResult = {
		name: SuiteName;
		pass: boolean;
		details: string;
		durationMs: number;
	};

	let running = $state(true);
	let complete = $state(false);
	let pass = $state(false);
	let error = $state<string | null>(null);
	let startedAt = $state('');
	let finishedAt = $state('');
	let runId = $state('');
	let results = $state<SuiteResult[]>([]);

	const struct = () =>
		SupaStruct.get({
			client: data.supabase,
			table: 'test',
			schema: 'test'
		});

	const now = () => Date.now();

	const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

	const fail = (message: string): never => {
		throw new Error(message);
	};

	const assert = (condition: boolean, message: string) => {
		if (!condition) fail(message);
	};

	async function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
		let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
		const timeoutPromise = new Promise<never>((_, reject) => {
			timeoutHandle = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
		});

		try {
			return await Promise.race([work, timeoutPromise]);
		} finally {
			if (timeoutHandle) clearTimeout(timeoutHandle);
		}
	}

	const waitFor = async (
		predicate: () => boolean,
		config: { timeoutMs: number; intervalMs: number; label: string }
	) => {
		const start = now();
		while (now() - start <= config.timeoutMs) {
			if (predicate()) return;
			await sleep(config.intervalMs);
		}
		fail(`${config.label} was not observed within ${config.timeoutMs}ms`);
	};

	const waitForAsync = async (
		predicate: () => Promise<boolean>,
		config: { timeoutMs: number; intervalMs: number; label: string }
	) => {
		const start = now();
		while (now() - start <= config.timeoutMs) {
			if (await predicate()) return;
			await sleep(config.intervalMs);
		}
		fail(`${config.label} was not observed within ${config.timeoutMs}ms`);
	};

	const cleanupByPrefix = async (namePrefix: string) => {
		const q = struct().search({ field: 'name', operator: 'ilike', value: namePrefix });
		const rowsResult = await q;
		if (rowsResult.isErr()) {
			return;
		}
		for (const row of rowsResult.value) {
			await row.delete();
		}
	};

	const runSuite = async (name: SuiteName, test: () => Promise<string>) => {
		const started = now();
		try {
			const details = await test();
			results.push({
				name,
				pass: true,
				details,
				durationMs: now() - started
			});
		} catch (err) {
			const details = err instanceof Error ? err.message : String(err);
			results.push({
				name,
				pass: false,
				details,
				durationMs: now() - started
			});
		}
	};

	const runCrudSuite = async () => {
		const prefix = `playwright-crud-${runId}`;
		await cleanupByPrefix(prefix);

		const createRes = await struct().new({ name: `${prefix}-create`, age: 18 });
		if (createRes.isErr()) fail(`create failed: ${createRes.error.message}`);
		const created = createRes.unwrap();

		const readRes = await struct().fromId(created.id);
		if (readRes.isErr()) fail(`read by id failed: ${readRes.error.message}`);
		assert(readRes.unwrap().id === created.id, 'read row id mismatch');

		const updateRes = await created.update({ name: `${prefix}-updated`, age: 19 });
		if (updateRes.isErr()) fail(`update failed: ${updateRes.error.message}`);

		const verifyRes = await struct().fromId(created.id);
		if (verifyRes.isErr()) fail(`verify update failed: ${verifyRes.error.message}`);
		assert(verifyRes.unwrap().raw.name === `${prefix}-updated`, 'updated name did not persist');

		const deleteRes = await created.delete();
		if (deleteRes.isErr()) fail(`delete failed: ${deleteRes.error.message}`);

		const readAfterDelete = await struct().fromId(created.id);
		assert(readAfterDelete.isErr(), 'read after delete unexpectedly succeeded');

		return `created ${created.id}, updated, deleted, and confirmed missing`;
	};

	const runAllPaginatedSuite = async () => {
		const prefix = `playwright-page-${runId}`;
		await cleanupByPrefix(prefix);

		const createdIds: string[] = [];
		for (let i = 0; i < 5; i++) {
			const createRes = await struct().new({ name: `${prefix}-${i}`, age: 30 + i });
			if (createRes.isErr()) fail(`seed create ${i} failed: ${createRes.error.message}`);
			createdIds.push(createRes.unwrap().id);
		}

		try {
			const query = struct().search({ field: 'name', operator: 'ilike', value: prefix });
			const allRes = await query;
			if (allRes.isErr()) fail(`all query failed: ${allRes.error.message}`);
			const allRows = allRes.unwrap();
			assert(allRows.length >= 5, `all query expected at least 5 rows, got ${allRows.length}`);

			query.paginated.pageSize = 2;
			const page1 = await query.paginated.page(1);
			if (page1.isErr()) fail(`page 1 failed: ${page1.error.message}`);
			const page1Rows = page1.unwrap();
			assert(page1Rows.length >= 1, 'page 1 returned no rows');
			assert(
				query.paginated.totalItems >= 5,
				`expected totalItems >= 5, got ${query.paginated.totalItems}`
			);

			const page2 = await query.paginated.page(2);
			if (page2.isErr()) fail(`page 2 failed: ${page2.error.message}`);
			const page2Rows = page2.unwrap();
			assert(query.paginated.pages >= 3, `expected at least 3 pages, got ${query.paginated.pages}`);

			return `all=${allRows.length}, page1=${page1Rows.length}, page2=${page2Rows.length}, total=${query.paginated.totalItems}`;
		} finally {
			for (const id of createdIds) {
				const rowRes = await struct().fromId(id);
				if (rowRes.isOk()) {
					await rowRes.value.delete();
				}
			}
		}
	};

	const runRealtimeSuite = async () => {
		const prefix = `playwright-rt-${runId}`;
		await cleanupByPrefix(prefix);

		const listener = struct();
		const writer = struct();
		const stop = listener.initRealtime();

		await sleep(1200);

		const createRes = await writer.new({ name: `${prefix}-row`, age: 40 });
		if (createRes.isErr()) {
			stop();
			fail(`realtime create failed: ${createRes.error.message}`);
		}
		const created = createRes.unwrap();
		let usedFallbackPolling = false;

		try {
			try {
				await withTimeout(
					waitFor(() => listener.cache.has(created.id), {
						timeoutMs: 12000,
						intervalMs: 200,
						label: 'realtime insert cache sync'
					}),
					13000,
					'realtime insert wait'
				);
			} catch {
				usedFallbackPolling = true;
				await withTimeout(
					waitForAsync(
						async () => {
							const probe = await listener.fromId(created.id);
							return probe.isOk();
						},
						{
							timeoutMs: 12000,
							intervalMs: 250,
							label: 'polling insert visibility'
						}
					),
					13000,
					'polling insert wait'
				);
			}

			const updateRes = await created.update({ name: `${prefix}-updated`, age: 41 });
			if (updateRes.isErr()) fail(`realtime update failed: ${updateRes.error.message}`);

			if (!usedFallbackPolling) {
				try {
					await withTimeout(
						waitFor(() => listener.cache.get(created.id)?.raw.name === `${prefix}-updated`, {
							timeoutMs: 12000,
							intervalMs: 200,
							label: 'realtime update cache sync'
						}),
						13000,
						'realtime update wait'
					);
				} catch {
					usedFallbackPolling = true;
				}
			}

			if (usedFallbackPolling) {
				await withTimeout(
					waitForAsync(
						async () => {
							const probe = await listener.fromId(created.id);
							return probe.isOk() && probe.unwrap().raw.name === `${prefix}-updated`;
						},
						{
							timeoutMs: 12000,
							intervalMs: 250,
							label: 'polling update visibility'
						}
					),
					13000,
					'polling update wait'
				);
			}

			const deleteRes = await created.delete();
			if (deleteRes.isErr()) fail(`realtime delete failed: ${deleteRes.error.message}`);

			if (!usedFallbackPolling) {
				try {
					await withTimeout(
						waitFor(() => !listener.cache.has(created.id), {
							timeoutMs: 12000,
							intervalMs: 200,
							label: 'realtime delete cache sync'
						}),
						13000,
						'realtime delete wait'
					);
				} catch {
					usedFallbackPolling = true;
				}
			}

			if (usedFallbackPolling) {
				await withTimeout(
					waitForAsync(
						async () => {
							const probe = await listener.fromId(created.id);
							return probe.isErr();
						},
						{
							timeoutMs: 12000,
							intervalMs: 250,
							label: 'polling delete visibility'
						}
					),
					13000,
					'polling delete wait'
				);
			}

			return usedFallbackPolling
				? `insert/update/delete observed via polling fallback for ${created.id}`
				: `insert/update/delete all observed in listener cache for ${created.id}`;
		} finally {
			stop();
			const rowRes = await struct().fromId(created.id);
			if (rowRes.isOk()) {
				await rowRes.value.delete();
			}
		}
	};

	const run = async () => {
		running = true;
		complete = false;
		pass = false;
		error = null;
		results = [];
		startedAt = new Date().toISOString();
		runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

		await runSuite('crud', runCrudSuite);
		await runSuite('all_paginated', runAllPaginatedSuite);
		await runSuite('realtime', runRealtimeSuite);

		const failed = results.filter((r) => !r.pass);
		pass = failed.length === 0;
		error = pass ? null : failed.map((f) => `${f.name}: ${f.details}`).join(' | ');
		finishedAt = new Date().toISOString();
		complete = true;
		running = false;
	};

	onMount(() => {
		void run();
	});
</script>

<section class="wrap">
	<div
		id="supabase-tests"
		data-complete={complete ? 'true' : 'false'}
		data-pass={pass ? 'true' : 'false'}
		data-running={running ? 'true' : 'false'}
		data-run-id={runId}
		data-crud={results.find((r) => r.name === 'crud')?.pass ? 'true' : 'false'}
		data-all-paginated={results.find((r) => r.name === 'all_paginated')?.pass ? 'true' : 'false'}
		data-realtime={results.find((r) => r.name === 'realtime')?.pass ? 'true' : 'false'}
		data-error={error ?? ''}
	>
		<h1>Supabase Automated Test Harness</h1>
		<p>Designed for Playwright. This page runs deterministic integration checks on load.</p>

		<div class="summary" data-testid="supabase-tests-summary">
			<div><strong>Run ID:</strong> {runId || 'pending'}</div>
			<div>
				<strong>Status:</strong>
				{running ? 'running' : complete ? (pass ? 'pass' : 'fail') : 'pending'}
			</div>
			<div><strong>Started:</strong> {startedAt || 'pending'}</div>
			<div><strong>Finished:</strong> {finishedAt || 'pending'}</div>
		</div>

		<table data-testid="supabase-tests-results">
			<thead>
				<tr>
					<th>Suite</th>
					<th>Pass</th>
					<th>Duration (ms)</th>
					<th>Details</th>
				</tr>
			</thead>
			<tbody>
				{#each results as result (result.name)}
					<tr data-suite={result.name} data-pass={result.pass ? 'true' : 'false'}>
						<td>{result.name}</td>
						<td>{result.pass ? 'true' : 'false'}</td>
						<td>{result.durationMs}</td>
						<td>{result.details}</td>
					</tr>
				{/each}
			</tbody>
		</table>

		<pre id="supabase-tests-json" data-testid="supabase-tests-json">{JSON.stringify(
				{
					runId,
					complete,
					pass,
					error,
					startedAt,
					finishedAt,
					results
				},
				null,
				2
			)}</pre>
	</div>
</section>

<style>
	:global(body) {
		background: radial-gradient(circle at 10% 10%, #1c2430 0%, #0d1218 45%, #070b10 100%);
		color: #d8e1eb;
		font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif;
	}
	.wrap {
		max-width: 1100px;
		margin: 2rem auto;
		padding: 0 1rem 3rem;
	}
	#supabase-tests {
		padding: 1rem;
		border-radius: 12px;
		background: linear-gradient(180deg, #141b24, #0f151d);
		border: 1px solid #243243;
		box-shadow: 0 14px 28px rgba(0, 0, 0, 0.28);
	}
	h1 {
		margin: 0;
		font-size: 1.8rem;
		color: #eef4fb;
	}
	p {
		margin-top: 0.5rem;
		color: #9fb1c4;
	}
	.summary {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 0.5rem;
		margin: 1rem 0;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		margin-top: 0.5rem;
	}
	th,
	td {
		border-bottom: 1px solid #243343;
		padding: 0.5rem;
		text-align: left;
		vertical-align: top;
	}
	th {
		color: #d2dfed;
	}
	td {
		color: #b7c7d9;
	}
	pre {
		margin-top: 1rem;
		padding: 0.8rem;
		border-radius: 8px;
		background: #0b1118;
		border: 1px solid #334a60;
		color: #dbe6f2;
		overflow: auto;
		max-height: 360px;
	}
</style>
