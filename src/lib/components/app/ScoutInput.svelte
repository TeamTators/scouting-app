<script lang="ts">
	import { globalData } from '$lib/model/app/global-data.svelte';

	interface Props {
		accounts: string[];
	}

	const { accounts }: Props = $props();
</script>

<div>
	<label for="scout"
		>Scout
		<br />
		<small class="text-muted"
			>Be sure to use the same username as tatorscout.org or else you won't grow your potato!</small
		>
	</label>
	<input
		class="form-control"
		type="text"
		name="scout"
		id="scout"
		bind:value={globalData.scout}
		placeholder="Scout Name"
		list="accounts"
	/>
	<datalist id="accounts">
		{#each accounts as a}
			<option value={a}></option>
		{/each}
	</datalist>
</div>
