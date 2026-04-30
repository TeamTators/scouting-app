<script lang="ts">
	import type { App } from '$lib/model/app/app';
	import { capitalize, fromCamelCase } from 'ts-utils';

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
			{#each Object.keys($contrib) as section}
				<th>{capitalize(fromCamelCase(section))}</th>
			{/each}
		</tr>
	</thead>
	<tbody>
		{#each Object.entries(app.config.yearInfo.actions) as [action, description]}
			<tr>
				<td>{description}</td>
				{#each Object.keys($contrib) as section}
					{@render cont($contrib[section][action] || 0)}
				{/each}
			</tr>
		{/each}
	</tbody>
</table>
