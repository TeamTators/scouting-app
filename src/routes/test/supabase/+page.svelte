<script lang="ts">
	import { SupaStruct } from '$lib/services/supabase/supastruct.svelte';
	import { onMount } from 'svelte';

	const { data } = $props();

	type TestResult = { name: string; pass: boolean; detail: string };

	let results = $state<TestResult[]>([]);
	let done = $state(false);
	let pass = $state(false);

	const ok = (name: string, detail: string) => results.push({ name, pass: true, detail });
	const err = (name: string, detail: string) => results.push({ name, pass: false, detail });

	const run = async () => {
		results = [];
		done = false;

		const prefix = `t-${Math.random().toString(36).slice(2, 7)}`;
		const listener = SupaStruct.get({ client: data.supabase, table: 'test', schema: 'test' });
		const writer = SupaStruct.get({ client: data.supabase, table: 'test', schema: 'test' });

		// Collect realtime events as they arrive
		const rtEvents: { type: string; id: string }[] = [];
		listener.on('new', (r) => rtEvents.push({ type: 'new', id: r.id }));
		listener.on('update', (r) => rtEvents.push({ type: 'update', id: r.id }));
		listener.on('delete', (r) => rtEvents.push({ type: 'delete', id: r.id }));
		const stop = listener.initRealtime();

		const waitFor = async (predicate: () => boolean, timeoutMs: number) => {
			const deadline = Date.now() + timeoutMs;
			while (Date.now() < deadline) {
				if (predicate()) return true;
				await new Promise((r) => setTimeout(r, 200));
			}
			return false;
		};

		const ids: string[] = [];

		const res = await writer.new(
			...Array.from({ length: 5 }, (_, i) => ({ name: `${prefix}-${i}`, age: 20 + i }))
		);
		if (res.isErr()) {
			err('create', res.error.message);
		} else {
			const rows = res.unwrap();
			rows.forEach((row, i) => {
				const id: string = row.id;
				ids.push(id);
				ok(`create-${i}`, `id=${id}`);
			});
		}

		if (!ids.length) {
			stop();
			done = true;
			pass = false;
			return;
		}

		const insertsReady = await waitFor(
			() => ids.every((id) => rtEvents.some((e) => e.type === 'new' && e.id === id)),
			10000
		);
		if (!insertsReady)
			err(
				'realtime-inserts',
				`got ${rtEvents.filter((e) => e.type === 'new').length}/${ids.length}`
			);
		else ok('realtime-inserts', `all ${ids.length} insert events received`);

		// ── fromId ────────────────────────────────────────────────────────
		for (const id of ids) {
			const res = await writer.fromId(id);
			if (res.isErr()) err(`fromId(${id})`, res.error.message);
			else ok(`fromId`, `found id=${res.unwrap().id}`);
		}

		// ── all() ─────────────────────────────────────────────────────────
		const allRes = await writer.all();
		if (allRes.isErr()) err('all', allRes.error.message);
		else {
			const mine = allRes.unwrap().filter((r) => r.raw.name?.startsWith(prefix));
			if (mine.length < 5) err('all', `got ${mine.length}, expected 5`);
			else ok('all', `${allRes.unwrap().length} total, ${mine.length} for this run`);
		}

		// ── get() ─────────────────────────────────────────────────────────
		const getRes = await writer.get({ name: `${prefix}-0` } as Parameters<typeof writer.get>[0]);
		if (getRes.isErr()) err('get', getRes.error.message);
		else ok('get', `${getRes.unwrap().length} row(s)`);

		// ── search() ─────────────────────────────────────────────────────
		const searchRes = await writer.search({ field: 'name', operator: 'ilike', value: prefix });
		if (searchRes.isErr()) err('search', searchRes.error.message);
		else ok('search', `${searchRes.unwrap().length} rows`);

		// ── pagination ────────────────────────────────────────────────────
		const q = writer.search({ field: 'name', operator: 'ilike', value: prefix });
		q.paginated.pageSize = 2;
		const p1 = await q.paginated.page(1);
		const p2 = await q.paginated.page(2);
		if (p1.isErr()) err('paginate-p1', p1.error.message);
		else if (p2.isErr()) err('paginate-p2', p2.error.message);
		else
			ok(
				'paginate',
				`total=${q.paginated.totalItems} pages=${q.paginated.pages} p1=${p1.unwrap().length} p2=${p2.unwrap().length}`
			);

		// ── update first row ──────────────────────────────────────────────
		const rowRes = await writer.fromId(ids[0]);
		if (rowRes.isErr()) {
			err('update', rowRes.error.message);
		} else {
			const upRes = await rowRes.unwrap().update({ name: `${prefix}-updated` });
			if (upRes.isErr()) err('update', upRes.error.message);
			else {
				const check = await writer.fromId(ids[0]);
				if (check.isErr()) err('update-verify', check.error.message);
				else if (check.unwrap().raw.name !== `${prefix}-updated`)
					err('update-verify', `got ${check.unwrap().raw.name}`);
				else ok('update', `name="${prefix}-updated" confirmed`);
			}
		}

		const updateReady = await waitFor(
			() => rtEvents.some((e) => e.type === 'update' && e.id === ids[0]),
			10000
		);
		if (!updateReady) err('realtime-update', `no update event for ${ids[0]}`);
		else ok('realtime-update', 'update event received');

		// ── delete all rows ───────────────────────────────────────────────
		for (const id of ids) {
			const r = await writer.fromId(id);
			if (r.isErr()) {
				ok(`delete-${id}`, 'already gone');
				continue;
			}
			const d = await r.unwrap().delete();
			if (d.isErr()) err(`delete-${id}`, d.error.message);
			else ok(`delete-${id}`, 'deleted');
		}

		const deletesReady = await waitFor(
			() => ids.every((id) => rtEvents.some((e) => e.type === 'delete' && e.id === id)),
			10000
		);
		if (!deletesReady) {
			const delCount = ids.filter((id) =>
				rtEvents.some((e) => e.type === 'delete' && e.id === id)
			).length;
			err('realtime-deletes', `got ${delCount}/${ids.length}`);
		} else {
			ok('realtime-deletes', `all ${ids.length} delete events received`);
		}

		stop();

		pass = results.every((r) => r.pass);
		done = true;
	};

	onMount(() => void run());
</script>

<div id="supabase-tests" data-complete={done} data-pass={pass}>
	<h2>Supabase Tests — {done ? (pass ? 'PASS' : 'FAIL') : 'running…'}</h2>
	<table>
		<thead><tr><th>Test</th><th>Result</th><th>Detail</th></tr></thead>
		<tbody>
			{#each results as r, i (`${r.name}-${i}`)}
				<tr>
					<td>{r.name}</td>
					<td style="color:{r.pass ? 'lightgreen' : 'salmon'}">{r.pass ? 'pass' : 'fail'}</td>
					<td>{r.detail}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
