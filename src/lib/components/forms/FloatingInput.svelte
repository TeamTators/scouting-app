<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		type: 'text' | 'textarea' | 'select';
		placeholder: string;
		label: string;
		value: string;
		name?: string;

		onInput?: (value: string) => void;
		onChange?: (value: string) => void;

		options?: Snippet;
	}

	let {
		type,
		name = '',
		placeholder,
		label,
		value = $bindable(),
		onInput = () => {},
		onChange = () => {},
		options
	}: Props = $props();

	const id =
		'input-' +
		Math.random().toString(36).substring(2, 15) +
		Math.random().toString(36).substring(2, 15);
</script>

<div class="form-floating">
	{#if type === 'textarea'}
		<textarea
			{id}
			class="form-control"
			{placeholder}
			{name}
			bind:value
			oninput={(e) => onInput(e.currentTarget.value)}
			onchange={(e) => onChange(e.currentTarget.value)}
		></textarea>
	{:else if type === 'text'}
		<input
			{id}
			class="form-control"
			{name}
			{placeholder}
			bind:value
			oninput={(e) => onInput(e.currentTarget.value)}
			onchange={(e) => onChange(e.currentTarget.value)}
		/>
	{:else if type === 'select'}
		<select
			{id}
			{name}
			class="form-select"
			bind:value
			oninput={(e) => onInput(e.currentTarget.value)}
			onchange={(e) => onChange(e.currentTarget.value)}
		>
			{@render options?.()}
		</select>
	{/if}
	<label for={id}>{label}</label>
</div>
