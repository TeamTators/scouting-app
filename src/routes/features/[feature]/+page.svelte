<script lang="ts">
	/* eslint-disable svelte/no-dom-manipulating */
	import { marked } from 'marked';
	import { onMount } from 'svelte';
	import nav from '$lib/nav/feature.js';

	nav();

	const { data } = $props();

	const feature = $derived(data.feature);

	let html: HTMLElement;

	const render = async () => {
		const parsed = feature.replace(/^---[\s\S]*?---\s*/m, '');
		const htmlText = await marked.parse(parsed);
		const el = document.createElement('div');

		el.innerHTML = htmlText;
		html.append(el);
	};

	onMount(() => {
		render();

		return () => {
			html.querySelectorAll('div').forEach((e) => e.remove());
		};
	});
</script>

<div class="container layer-2">
	<div bind:this={html}></div>
</div>
