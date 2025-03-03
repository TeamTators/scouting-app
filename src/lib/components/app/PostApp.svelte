<script lang="ts">
	import { App, SECTIONS } from '$lib/model/app/app';
	import { contextmenu } from '$lib/utils/contextmenu';
	import { confirm } from '$lib/utils/prompts';
	import { Canvas } from 'canvas/canvas';
	import { Circle } from 'canvas/circle';
	import { Container } from 'canvas/container';
	import type { Drawable } from 'canvas/drawable';
	import { Img } from 'canvas/image';
	import { Path } from 'canvas/path';
	import { onMount } from 'svelte';
	interface Props {
		app: App;
	}

	const { app }: Props = $props();

	let target: HTMLCanvasElement;
	let canvas: Canvas;
	const actions = new Map<number, number>();
	let container: Container;

	export const render = (app: App) => {
		actions.clear();
		canvas.emitter.destroyEvents();
		if (!canvas) return;
		canvas.clear();
		const field = new Img(`/fields/${app.matchData.year}.png`, {
			width: 1,
			height: 1,
			x: 0,
			y: 0
		});
		const trace = app.serialize().trace;
		console.log(trace);
		container = new Container(
			...(trace
				.map((p, i, a) => {
					if (i === 0) {
						const [, x, y, a] = p;
						if (a) {
							return new Circle([x, y], 0.03);
						}
						return;
					}
					const [, x, y, act] = p;
					const [, prevX, prevY] = a[i - 1];
					const path = new Path([
						[prevX, prevY],
						[x, y]
					]);

					if (i < SECTIONS.auto[1]) {
						path.properties.line.color = 'blue';
					} else if (i < SECTIONS.teleop[1]) {
						path.properties.line.color = 'green';
					} else {
						path.properties.line.color = 'red';
					}

					if (act) {
						const action = new Circle([x, y], 0.03);
						action.fill.color = 'red';
						action.properties.line.color = 'red';
						actions.set(action.id, i + 1);
						const img = new Img(`/icons/${act}.png`, {
							width: 0.05,
							height: 0.05,
							x: x - 0.025,
							y: y - 0.025
						});
						return [path, new Container(action, img)];
					}

					return [path];
				})
				.filter((d) => d)
				.flat() as Drawable[])
		);
		canvas.add(field, container);
		canvas.on('click', (event) => {
			const [[x, y]] = event.points;
			const el = container.children.find((d) => {
				if (!(d instanceof Container)) return;
				const [circle] = d.children;
				if (!(circle instanceof Circle)) return;
				return circle.isIn([x, y]);
			}) as Container | undefined;
			if (el) {
				const [circle] = el.children as [Circle, Img];
				confirm('Are you sure you want to delete this action?').then((res) => {
					if (res) {
						const index = actions.get(circle.id);
						// console.log(index);
						if (index !== undefined) {
							// console.log(app.ticks);
							const tick = app.state.ticks[index];
							// console.log(tick);
							if (tick) {
								tick.action = 0;
								tick.data = null;
								render(app);
							}
						}
					}
				});
			}
		});
	};

	onMount(() => {
		const ctx = target.getContext('2d');
		if (!ctx) {
			throw new Error('Could not get 2d context');
		}
		canvas = new Canvas(ctx, {
			events: ['click']
		});
		render(app);

		return canvas.animate();
	});
</script>

<canvas bind:this={target} style="width: 100%; aspect-ratio: 2;" height="500" width="1000"></canvas>
