<script lang="ts">
	import type { Check } from '$lib/model/app/checks';
	import { capitalize, fromCamelCase } from 'ts-utils/text';

	interface Props {
		check: Check;
		color: 'success' | 'primary' | 'warning' | 'danger';
	}

	const { check, color }: Props = $props();
</script>

<div
	style="
    aspect-ratio: 1 / 1;
    width: 98px !important;
"
>
	<input
		type="checkbox"
		name={$check.name}
		class="
			btn-check
		"
		id="check-{color}-{$check.name}"
		bind:checked={$check.value}
		onchange={(e) => {
			check.set({
				...check.data,
				value: e.currentTarget.checked
			});
		}}
	/>
	<label
		for="check-{color}-{$check.name}"
		class="btn bg-lg btn-outline-{color} text-align-middle w-100 h-100 p-0"
		>{capitalize(fromCamelCase($check.name))}</label
	>
</div>
