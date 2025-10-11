<script lang="ts">
	import { App } from '$lib/model/app/app';
	import { Check } from '$lib/model/app/checks';
	import CheckRow from '$lib/components/app/Check.svelte';
	import Slider from '$lib/components/app/Slider.svelte';
	import Comment from './Comment.svelte';
	import { onMount } from 'svelte';

	interface Props {
		app: App;
	}

	const { app }: Props = $props();

	const checks = app.checks;
	const comments = app.comments;

	let success = $state(checks.writables.success);
	let primary = $state(checks.writables.primary);
	let warning = $state(checks.writables.warning);
	let danger = $state(checks.writables.danger);

	onMount(() => {
		app.on('reset', () => {
			success = checks.writables.success;
			primary = checks.writables.primary;
			warning = checks.writables.warning;
			danger = checks.writables.danger;
		});
	});
</script>

{#snippet checksRow(checks: Check[], color: 'success' | 'primary' | 'warning' | 'danger')}
	<div class="row mb-3">
		<div
			style="
            display: grid;
            grid-template-columns: repeat(var(--grid-size), 1fr);
            gap: 8px;
        "
		>
			{#each checks as check}
				{#if check.data.render}
					<CheckRow {check} {color} />
				{/if}
			{/each}
		</div>
	</div>
{/snippet}

<div class="container" style="padding-top: {38 + 16}px;">
	{@render checksRow($success, 'success')}
	{@render checksRow($primary, 'primary')}
	{@render checksRow($warning, 'warning')}
	{@render checksRow($danger, 'danger')}
	{#each $success as check}
		<Slider {check} color="success" />
	{/each}
	{#each $primary as check}
		<Slider {check} color="primary" />
	{/each}
	{#each $warning as check}
		<Slider {check} color="warning" />
	{/each}
	{#each $danger as check}
		<Slider {check} color="danger" />
	{/each}
	{#each $comments as comment}
		<Comment {comment} />
	{/each}
</div>

<style>
	:root {
		--grid-size: 5; /* Default for extra-large screens */
	}

	@media (max-width: 1200px) {
		:root {
			--grid-size: 10; /* Large screens */
		}
	}

	@media (max-width: 992px) {
		:root {
			--grid-size: 8; /* Medium screens */
		}
	}

	@media (max-width: 768px) {
		:root {
			--grid-size: 6; /* Small screens */
		}
	}

	@media (max-width: 576px) {
		:root {
			--grid-size: 4 !important; /* Extra small screens */
		}
	}
</style>
