<script lang="ts">
	import { App } from '$lib/model/app/app';

	interface Props {
		app: App;
	}

	const { app }: Props = $props();

	const settings = $derived(app.settings);
</script>

{#each $settings as setting, i}
	{@const value = setting.value}
	<div class="row mb-3">
		<label for={setting.id} class="form-label">{setting.name}</label>
		{#if setting.options !== undefined}
			<select class="form-select" id={setting.id} bind:value={value.data}>
				{#each setting.options as option}
					<option value={option.value}>{option.name}</option>
				{/each}
			</select>
		{:else if setting.type === 'string'}
			<input type="text" class="form-control" id={setting.id} bind:value={value.data} />
		{:else if setting.type === 'number'}
			<input type="number" class="form-control" id={setting.id} bind:value={value.data} />
		{:else if setting.type === 'boolean'}
			<div class="form-check form-switch">
				<input
					class="form-check-input"
					type="checkbox"
					id={setting.id}
					bind:checked={value.data as boolean}
				/>
			</div>
		{/if}
		<div id={`${setting.id}-description`} class="form-text">{setting.description}</div>
	</div>
	{#if i < $settings.length - 1}
		<hr />
	{/if}
{/each}
