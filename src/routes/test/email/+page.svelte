<script lang="ts">
	import { onMount } from 'svelte';
	const { data } = $props();

	let div: HTMLDivElement;

	const render = (name: keyof typeof data) => {
		if (div && name in data && typeof data[name] === 'string') {
			const container = document.createElement('div');
			container.classList.add('d-flex');
			// eslint-disable-next-line svelte/no-dom-manipulating
			div.appendChild(container);
			const left = document.createElement('div');
			left.innerHTML = data[name] as string;
			left.classList.add('w-50');
			container.appendChild(left);
			const right = document.createElement('pre');
			right.textContent = data[name] as string;
			right.classList.add('w-50');
			right.style.whiteSpace = 'pre-wrap';
			container.appendChild(right);
		}
	};

	onMount(() => {
		render('newsletter');
	});
</script>

<div bind:this={div}></div>
