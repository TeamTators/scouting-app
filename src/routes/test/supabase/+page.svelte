<script lang="ts">
	import { runTests } from '$lib/model/testing';
	import Test from '$lib/components/general/Test.svelte';

	const arr = runTests();
	const success = arr.derived((arr) => arr.filter((test) => test.data.success === true));
	const failed = arr.derived((arr) => arr.filter((test) => test.data.success === false));
	const pending = arr.derived((arr) => arr.filter((test) => test.data.pending));
	const complete = arr.derived((arr) => arr.filter((test) => !test.data.pending).length);
	const total = arr.length;
</script>

<div
	class="container"
	id="supabase-tests"
	data-pass={$success.length === total}
	data-complete={$complete === total}
	data-total={total}
>
	<div class="row mb-3">
		<div class="col">
			<h1>Supabase Tests</h1>
			<p class="lead">
				This page runs a series of tests against the Supabase database and displays the results.
			</p>
			<p>Complete: {$complete} / {total}</p>
		</div>
	</div>
	<div class="row mb-3">
		<h2>Success ({$success.length} / {total})</h2>
		{#each $success as test}
			<div class="col-4 mb-3">
				<Test {test} />
			</div>
		{/each}
	</div>
	<div class="row mb-3">
		<h2>Failed ({$failed.length} / {total})</h2>
		{#each $failed as test}
			<div class="col-4 mb-3">
				<Test {test} />
			</div>
		{/each}
	</div>
	<div class="row mb-3">
		<h2>Pending ({$pending.length} / {total})</h2>
		{#each $pending as test}
			<div class="col-4 mb-3">
				<Test {test} />
			</div>
		{/each}
	</div>
</div>
