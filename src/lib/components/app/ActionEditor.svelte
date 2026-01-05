<script lang="ts">
	import type { App } from '$lib/model/app/app';
	import type { Action } from 'tatorscout/trace';
	import { EventEmitter } from 'ts-utils';

	interface Props {
		app: App;
		current?: string;
	}

	const { app, current }: Props = $props();

	const em = new EventEmitter<{
		select: Action;
		cancel: undefined;
	}>();

	export const on = em.on.bind(em);
	export const off = em.off.bind(em);
</script>

<div class="grid">
	{#each Object.entries(app.config.yearInfo.actions) as [action, details]}
		<div class="grid-item">
			<button
				class="btn"
				onclick={() => {
					em.emit('select', action as Action);
				}}
				disabled={action === current}
				class:btn-primary={action !== current}
				class:btn-secondary={action === current}
			>
				<img src="/icons/{action}.png" alt={details} />
				{details}
			</button>
		</div>
	{/each}
</div>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
		gap: 1rem;
	}

	.grid-item {
		text-align: center;
		max-width: 1fr;
		min-width: 100px;
	}

	.grid-item button {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 1rem;
	}

	.grid-item img {
		margin-bottom: 0.5rem;
		width: 100%;
		height: auto;
	}
</style>
