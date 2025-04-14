<script lang="ts">
	import { Check } from '$lib/model/app/checks';
	import { Form } from '$lib/utils/form';
	import { capitalize, fromCamelCase } from 'ts-utils/text';
	interface Props {
		check: Check;
		color: 'success' | 'primary' | 'warning' | 'danger';
	}

	const { check, color }: Props = $props();
</script>

{#if $check.value && $check.doSlider}
	<div class="row mb-3">
		<div class="col">
			<div class="card border-{color}">
				<label for="slider-{$check.name}" class="form-label px-3 pt-3">
					{capitalize(fromCamelCase($check.name))}: {$check.values[$check.slider] || 'Please make an input'}
				</label>
				<input type="range" class="form-range" id="slider-{$check.name}" min="0" max="4" bind:value={$check.slider} />
			</div>
		</div>
	</div>
{/if}
