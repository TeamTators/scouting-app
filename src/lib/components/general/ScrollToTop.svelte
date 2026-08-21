<script lang="ts">
	let y = $state(0);
	let show_back_to_top = $derived(y !== 0);
</script>

<svelte:window bind:scrollY={y} />
<button
	type="button"
	class:hide-back-to-top={!show_back_to_top}
	class="
            btn btn-primary position-fixed bottom-0 end-0 m-3
        "
	style="z-index: 1050; will-change: opacity; transition: opacity 0.3s ease-in-out;"
	onclick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
>
	<i class="material-icons">arrow_upward</i>
</button>

<style>
	.hide-back-to-top {
		pointer-events: none;
		opacity: 0;
	}
</style>
