<script lang="ts">
	import type { App } from '$lib/model/app/app';

	interface Props {
		app: App;
	}

	const { app }: Props = $props();

	const contrib = $derived(app.contribution);
</script>

{#snippet cont(value: number)}
	<td class:text-success={value > 0}>{value}</td>
{/snippet}

<table class="table table-striped table-dark">
	<thead>
		<tr>
			<th></th>
			<th>Auto</th>
			<th>Teleop</th>
			<th>Endgame</th>
		</tr>
	</thead>
	<tbody>
		{#each Object.entries(app.config.yearInfo.actions) as [action, description]}
			<tr>
				<td>{description}</td>
				{@render cont($contrib.auto[action] || 0)}
				{@render cont($contrib.teleop[action] || 0)}
				{@render cont($contrib.endgame[action] || 0)}
			</tr>
		{/each}
	</tbody>
</table>
