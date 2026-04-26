<script lang="ts">
	import { Test } from '$lib/model/testing';

	interface Props {
		test: Test;
	}

	const { test }: Props = $props();
</script>

<div
	class="alert"
	class:alert-danger={$test.success === false}
	class:alert-success={$test.success === true}
	class:alert-info={$test.pending === true}
	role="alert"
>
	<h5>
		{$test.name}
	</h5>
	{#if $test.message}
		<p class="text-muted">{$test.message}</p>
	{/if}
</div>
