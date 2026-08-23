<script lang="ts">
	import { loading_state } from '$lib/utils/loading.svelte';

	const message = $derived(loading_state.message);
	const state = $derived(loading_state.state);
</script>

{#if state !== 'idle'}
	<div class="backdrop" class:fade={state === 'fading'}>
		<div class="spinner-border" role="status">
			<span class="visually-hidden">Loading...</span>
		</div>
		<div class="message">{message}</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.message {
		color: white;
		font-size: 1.5rem;
		margin-left: 1rem;
	}

	.fade {
		animation: fadeOut 0.3s forwards;
	}

	@keyframes fadeOut {
		from {
			opacity: 1;
		}
		to {
			opacity: 0;
		}
	}
</style>
