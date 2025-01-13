<script lang="ts">
	import { notify } from '$lib/utils/prompts';
	import { onMount } from 'svelte';
	import { sleep } from 'ts-utils/sleep';

	const addNotif = () =>
		notify({
			type: 'toast',
			color: 'success',
			message: 'Test Message',
			title: 'Test title'
		});
</script>

<button type="button" class="btn btn-primary" onclick={addNotif}>Click me!</button>
