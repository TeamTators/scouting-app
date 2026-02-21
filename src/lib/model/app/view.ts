import { App } from './app';
import { Timer } from './timer';
import { Color } from 'colors/color';
import { sleep } from 'ts-utils/sleep';
import type { Point2D } from 'math/point';
import { browser } from '$app/environment';
import { globalData } from './global-data.svelte';
import { mount, unmount } from 'svelte';
import Cover from '$lib/components/app/Cover.svelte';
import { SimpleEventEmitter } from 'ts-utils';
import { WritableBase } from '$lib/services/writables';
import type { P, TraceArray } from 'tatorscout/trace';
import { contextmenu } from '$lib/utils/contextmenu';
import { confirm, rawModal } from '$lib/utils/prompts';
import ActionEditor from '$lib/components/app/ActionEditor.svelte';
import { catmullRom } from 'math/spline';
import { RangeSlider } from '$lib/utils/form';

class Points {
	points: Point2D[] = [];

	constructor(
		public readonly max: number,
		public removeAfter: number // ms
	) {}

	add(point: Point2D) {
		this.points.push(point);
		let removed = false;
		if (this.points.length > this.max) {
			removed = true;
			this.points.shift();
		}

		setTimeout(() => {
			if (removed) return;
			this.points.shift();
		}, this.removeAfter);
	}

	clear() {
		this.points = [];
	}
}

export class AppView {
	private readonly emitter = new SimpleEventEmitter<'init'>();

	public readonly on = this.emitter.on.bind(this.emitter);
	public readonly off = this.emitter.off.bind(this.emitter);
	public readonly once = this.emitter.once.bind(this.emitter);
	public readonly emit = this.emitter.emit.bind(this.emitter);

	public readonly timer: Timer;
	public borderPoints: Point2D[] = [];

	public drawing = false;
	public clicking = false;

	public target: HTMLElement | undefined;
	public svg: SVGElement | undefined;
	public path: SVGPathElement | undefined;
	public border: SVGPolygonElement | undefined;
	public background: HTMLImageElement | undefined;
	public container: HTMLDivElement | undefined;
	public readonly areas: {
		polygon: SVGPolygonElement;
		condition: (shape: Point2D[]) => boolean;
		color: Color;
		zone: string;
		points: Point2D[];
	}[] = [];
	points = new Points(200, 1500);

	constructor(public readonly app: App) {
		this.timer = new Timer(app);
	}

	init(target: HTMLElement) {
		if (this.target) throw new Error('AppView has already been initialized');
		if (!browser) throw new Error('AppView.init() can only be used on the client side');
		this.target = target;
		target.innerHTML = '';
		target.style.position = 'relative';
		target.style.overflow = 'hidden';
		target.style.userSelect = 'none';
		target.style.margin = 'auto';

		this.container = document.createElement('div');
		this.container.style.position = 'absolute';
		this.container.style.top = '0';
		this.container.style.left = '0';
		this.container.style.width = '100%';
		this.container.style.height = '100%';
		target.appendChild(this.container);

		const img = document.createElement('img');
		img.src = `/fields/${this.app.matchData.year}.png`;
		img.style.position = 'absolute';
		img.style.top = '0';
		img.style.left = '0';
		img.style.width = '100%';
		img.style.height = '100%';
		img.style.objectFit = 'cover';
		this.background = img;
		this.container.appendChild(img);

		this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		this.svg.setAttribute('width', '100%');
		this.svg.setAttribute('height', '100%');
		this.svg.setAttribute('viewBox', '0 0 2 1');
		this.svg.style.position = 'absolute';
		this.svg.style.top = '0';
		this.svg.style.left = '0';
		this.container.appendChild(this.svg);

		this.path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
		this.path.setAttribute('fill', 'none');
		this.path.setAttribute('stroke', 'rgba(255, 230, 0, 0.5)');
		this.path.setAttribute('stroke-width', '.005');
		this.path.setAttribute('stroke-linecap', 'round');
		this.svg.appendChild(this.path);

		this.border = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
		this.border.setAttribute('fill', 'rgba(0, 0, 0, 0)');
		this.border.setAttribute('stroke', 'rgba(0, 0, 0, 1)');
		this.border.setAttribute('stroke-width', '2');
		this.svg.appendChild(this.border);

		// Cover screen until first interaction
		{
			const coverContainer = document.createElement('div');
			const cover = mount(Cover, {
				target: coverContainer,
				props: {
					app: this.app,
					scout: globalData.scout
				}
			});

			// if (this.app.matchData.alliance === null) console.error('alliance value is null');

			coverContainer.style.position = 'absolute';
			coverContainer.style.width = '100vw';
			coverContainer.style.height = '100vh';
			coverContainer.style.zIndex = '9999';
			coverContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';

			const transferStart = (e: MouseEvent | TouchEvent) => {
				coverContainer.removeEventListener('mousedown', transferStart);
				coverContainer.removeEventListener('touchstart', transferStart);
				unmount(cover);
				coverContainer.remove();

				this.app.start();

				if (e instanceof MouseEvent) {
					this.container?.dispatchEvent(new MouseEvent('mousedown', e));
				}

				if (e instanceof TouchEvent) {
					this.container?.dispatchEvent(
						new TouchEvent('touchstart', {
							touches: Array.from(e.touches),
							targetTouches: Array.from(e.targetTouches),
							changedTouches: Array.from(e.changedTouches),
							composed: e.composed
						})
					);
				}
			};

			const transferMove = (e: TouchEvent) => {
				this.container?.dispatchEvent(
					new TouchEvent('touchmove', {
						touches: Array.from(e.touches),
						targetTouches: Array.from(e.targetTouches),
						changedTouches: Array.from(e.changedTouches),
						composed: e.composed
					})
				);
			};

			const transferEnd = (e: TouchEvent) => {
				this.container?.dispatchEvent(
					new TouchEvent('touchend', {
						touches: Array.from(e.touches),
						targetTouches: Array.from(e.targetTouches),
						changedTouches: Array.from(e.changedTouches),
						composed: e.composed
					})
				);

				coverContainer.removeEventListener('touchmove', transferMove);
				coverContainer.removeEventListener('touchend', transferEnd);
			};

			// TODO: integrate touch move and end
			// On the first start event, we need to forward all pointer events to the canvas

			coverContainer.addEventListener('mousedown', transferStart);
			coverContainer.addEventListener('touchstart', transferStart);
			coverContainer.addEventListener('touchmove', transferMove);
			coverContainer.addEventListener('touchend', transferEnd);

			this.container.appendChild(coverContainer);
		}

		for (const object of this.app.gameObjects) {
			target.appendChild(object.element);
		}
		this.timer.init(target);

		// Set up listeners:
		const push = (x: number, y: number) => {
			if (!this.drawing) return;
			if (x < 0 || y < 0) return;
			this.app.state.currentLocation = [x, y];
			this.points.add([x, y]);
		};

		const down = (x: number, y: number) => {
			if (this.clicking) return;
			this.drawing = true;
			if (x === -1 && y === -1) return;
			push(x, y);
		};
		const move = (x: number, y: number) => {
			if (this.clicking) return;
			if (x === -1 && y === -1) return;
			push(x, y);
		};
		const up = (x: number, y: number) => {
			if (this.clicking) return;
			this.drawing = false;
			// this.app.state.currentLocation = null;
			if (x === -1 && y === -1) return;
			push(x, y);
		};

		const getXY = (e: MouseEvent | TouchEvent): Point2D => {
			if (!this.target) return [-1, -1];
			const rect = this.target.getBoundingClientRect();

			let clientX: number;
			let clientY: number;

			if (e instanceof MouseEvent) {
				clientX = e.clientX;
				clientY = e.clientY;
			} else if (e instanceof TouchEvent) {
				if (e.touches.length > 0) {
					clientX = e.touches[0].clientX;
					clientY = e.touches[0].clientY;
				} else if (e.changedTouches.length > 0) {
					clientX = e.changedTouches[0].clientX;
					clientY = e.changedTouches[0].clientY;
				} else {
					return [-1, -1];
				}
			} else {
				return [-1, -1];
			}

			const x = (clientX - rect.left) / rect.width;
			const y = (clientY - rect.top) / rect.height;

			return [x, y];
		};

		const mousedown = (e: MouseEvent) => {
			e.preventDefault();
			down(...getXY(e));
		};

		const mousemove = (e: MouseEvent) => {
			e.preventDefault();
			move(...getXY(e));
		};

		const mouseup = (e: MouseEvent) => {
			e.preventDefault();
			up(...getXY(e));
		};

		const touchstart = (e: TouchEvent) => {
			e.preventDefault();
			down(...getXY(e));
		};

		const touchmove = (e: TouchEvent) => {
			e.preventDefault();
			move(...getXY(e));
		};

		const touchend = (e: TouchEvent) => {
			e.preventDefault();
			up(...getXY(e));
		};

		this.container.addEventListener('mousedown', mousedown);
		this.container.addEventListener('mousemove', mousemove);
		this.container.addEventListener('mouseup', mouseup);
		this.container.addEventListener('touchstart', touchstart, { passive: false });
		this.container.addEventListener('touchmove', touchmove, { passive: false });
		this.container.addEventListener('touchend', touchend, { passive: false });

		this.draw();

		this.app.on('action', ({ action, point, alliance }) => {
			this.animateIcon(action, point, alliance);
		});

		this.emit('init');
	}

	reset() {
		this.points.clear();
		this.timer.reset();
	}

	draw() {
		if (!(this.svg && this.path && this.border && this.target)) return;
		{
			// always keep aspect ratio 2:1
			const viewWidth = window.innerWidth;
			const viewHeight = window.innerHeight;

			if (viewWidth / viewHeight > 2) {
				this.target.style.width = `${viewHeight * 2}px`;
				this.target.style.height = `${viewHeight}px`;
			} else {
				this.target.style.height = `${viewWidth / 2}px`;
				this.target.style.width = `${viewWidth}px`;
			}
		}

		const { flipX, flipY } = globalData;

		const getPoint = (point: Point2D): Point2D => {
			return [flipX ? 1 - point[0] : point[0], flipY ? 1 - point[1] : point[1]];
		};

		if (flipX) {
			this.background!.style.transform = 'scaleX(-1)';
		} else {
			this.background!.style.transform = 'scaleX(1)';
		}

		if (flipY) {
			this.background!.style.transform += ' scaleY(-1)';
		} else {
			this.background!.style.transform += ' scaleY(1)';
		}

		for (const obj of this.app.gameObjects) {
			obj.element.style.position = 'absolute';
			obj.element.style.transform = 'translate(-50%, -50%)';
			const show = () => {
				const [x, y] = obj.point;
				const { staticX, staticY } = obj;
				const [px, py] = [staticX ? x : flipX ? 1 - x : x, staticY ? y : flipY ? 1 - y : y];
				obj.element.style.left = `${px * this.target!.clientWidth}px`;
				obj.element.style.top = `${py * this.target!.clientHeight}px`;
				if (obj.alliance && obj.alliance !== this.app.matchData.alliance) {
					obj.element.style.display = 'none';
				} else {
					obj.element.style.display = 'block';
				}
			};
			if (!obj.viewCondition) {
				show();
			} else {
				const tick = this.app.state.tick;
				if (tick && obj.viewCondition(tick)) {
					show();
				} else {
					obj.element.style.display = 'none';
				}
			}
		}

		for (const zone of this.areas) {
			if (zone.condition(zone.points.map(getPoint))) {
				zone.polygon.setAttribute('fill', zone.color.setAlpha(0.25).toString('rgba'));
				zone.polygon.setAttribute(
					'points',
					zone.points
						.map(getPoint)
						.map(([x, y]) => `${x * 2} ${y}`)
						.join(', ')
				);
			}
		}

		// this.border.setAttribute('points', this.borderPoints.map(getPoint).map(([x, y]) => `${x * 2} ${y}`).join(', '));

		const pathData = this.points.points
			.map((point, i) => {
				const [x, y] = point;
				return `${i === 0 ? 'M' : 'L'} ${x * 2} ${y}`;
			})
			.join(' ');

		this.path.setAttribute('d', pathData);
	}

	start() {
		let doStop = false;
		const view = () => {
			if (doStop) return;
			this.draw();
			requestAnimationFrame(view);
		};
		requestAnimationFrame(view);
		return () => {
			doStop = true;
		};
	}

	setBorder(points: Point2D[]) {
		this.borderPoints = points;
	}

	addArea(config: {
		zone: string;
		points: Point2D[];
		color: Color;
		condition: (shape: Point2D[]) => boolean;
	}) {
		this.once('init', () => {
			const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
			polygon.style.zIndex = '0';
			polygon.setAttribute('fill', config.color.setAlpha(0).toString('rgba'));
			polygon.setAttribute('stroke', config.color.toString('rgba'));
			polygon.setAttribute('stroke-width', '2');
			this.svg?.appendChild(polygon);
			this.areas.push({
				polygon,
				condition: config.condition,
				color: config.color,
				zone: config.zone,
				points: config.points
			});
		});
	}

	animateIcon(icon: string, position: Point2D, alliance: 'red' | 'blue' | null) {
		if (!browser) return;
		if (!this.target) return;
		const img = document.createElement('img');
		img.src = `/icons/${icon}.png`;
		img.style.position = 'absolute';
		img.style.transform = 'translate(-50%, -50%) !important;';
		img.style.height = '25px';
		img.style.width = '25px';
		img.style.zIndex = '200';
		const [x, y] = position;
		img.style.left = `${x * this.target.clientWidth}px`;
		img.style.top = `${y * this.target.clientHeight}px`;
		img.style.backgroundColor = (() => {
			switch (alliance) {
				case 'red':
					return Color.fromBootstrap('red');
				case 'blue':
					return Color.fromBootstrap('blue');
				default:
					return Color.fromBootstrap('dark');
			}
		})()
			.setAlpha(0.75)
			.toString('rgba');

		img.classList.add('animate__animated', 'animate__bounceIn', 'circle');

		this.target?.appendChild(img);

		const onEnd = async () => {
			img.removeEventListener('animationend', onEnd);
			img.classList.remove('animate__animated', 'animate__bounceIn');
			await sleep(500);

			img.classList.add('animate__animated', 'animate__bounceOut');
			const remove = () => {
				img.remove();
				img.removeEventListener('animationend', remove);
			};
			img.addEventListener('animationend', remove);
		};

		img.addEventListener('animationend', onEnd);
	}
}

export class SummaryView extends WritableBase<{ from: number; to: number }> {
	public readonly svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	public readonly background = document.createElement('img');
	public trace: TraceArray = [];
	private sliderCleanup = () => {};
	private sliderUnsub = () => {};
	private rangeUnsub = () => {};
	private sliderEl?: HTMLDivElement;

	constructor(
		public readonly app: App,
		public readonly target: HTMLDivElement
	) {
		super({
			from: 0,
			to: 0
		});
	}

	init() {
		this.trace = this.app.state.traceArray();
	}

	render(from: number, to: number) {
		const cleanupRange = this.rangeUnsub;
		const cleanupSliderSub = this.sliderUnsub;
		const cleanupSlider = this.sliderCleanup;
		this.rangeUnsub = () => {};
		this.sliderUnsub = () => {};
		this.sliderCleanup = () => {};
		cleanupRange();
		cleanupSliderSub();
		cleanupSlider();
		this.sliderEl?.remove();
		this.sliderEl = undefined;

		this.init();
		if (this.trace.length === 0) {
			this.target.innerHTML = '';
			let onreset = () => {};
			return {
				onreset: (cb: () => void) => {
					onreset = cb;
				},
				view: () => {
					onreset();
				}
			};
		}

		const maxIndex = this.trace.length - 1;
		const resolvedFrom = Math.max(0, from);
		const resolvedTo = to < 0 ? maxIndex : to;
		const clampedFrom = Math.min(resolvedFrom, maxIndex);
		const clampedTo = Math.max(clampedFrom, Math.min(resolvedTo, maxIndex));
		const trace = this.trace;
		this.set({ from: clampedFrom, to: clampedTo });
		const rerender = () => {
			this.commit();
			this.destroy();
			const obj = this.render(this.data.from, this.data.to);
			Object.assign(returnObj, obj);
			onreset();
		};

		const { flipX, flipY } = globalData;
		let currentFrom = clampedFrom;
		let currentTo = clampedTo;

		this.target.innerHTML = '';
		this.target.style.position = 'relative';
		this.target.style.width = '100%';
		this.target.style.aspectRatio = '2 / 1';
		this.target.style.overflow = 'hidden';

		this.background.src = `/fields/${this.app.matchData.year}.png`;
		this.background.style.position = 'absolute';
		this.background.style.top = '0';
		this.background.style.left = '0';
		this.background.style.width = '100%';
		this.background.style.height = '100%';
		this.background.style.objectFit = 'cover';
		this.background.style.zIndex = '0';
		if (flipX) {
			this.background.style.transform = 'scaleX(-1)';
		} else {
			this.background.style.transform = 'scaleX(1)';
		}
		if (flipY) {
			this.background.style.transform += ' scaleY(-1)';
		} else {
			this.background.style.transform += ' scaleY(1)';
		}
		this.target.appendChild(this.background);

		this.svg.setAttribute('width', '100%');
		this.svg.setAttribute('height', '100%');
		this.svg.setAttribute('viewBox', '0 0 2 1');
		this.svg.style.position = 'absolute';
		this.svg.style.top = '0';
		this.svg.style.left = '0';
		this.svg.style.zIndex = '1';
		this.target.appendChild(this.svg);

		const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
		path.setAttribute('fill', 'none');
		path.setAttribute('stroke', 'rgba(255, 230, 0, 0.5)');
		path.setAttribute('stroke-width', '.005');
		path.setAttribute('stroke-linecap', 'round');

		const showPath = (from: number, to: number) => {
			currentFrom = from;
			currentTo = to;
			// const d = trace
			// 	.slice(from, to + 1)
			// 	.map((point, i) => {
			// 		const [, x, y] = point;
			// 		return `${i === 0 ? 'M' : 'L'} ${x * 2} ${y}`;
			// 	})
			// 	.join(' ');
			// path.setAttribute('d', d);

			const fn = catmullRom(trace.slice(from, to + 1).map((p) => [p[1] * 2, p[2]]));

			const d: string[] = [];
			for (let i = 0; i <= 1; i += 0.001) {
				const [x, y] = fn(i);
				d.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
			}

			path.setAttribute('d', d.join(' '));
		};
		showPath(currentFrom, currentTo);

		this.svg.appendChild(path);

		const removeListeners: (() => void)[] = [];
		const buttons: HTMLButtonElement[] = [];

		const moveState = (index: number) => {
			const point = trace[index];
			const traceCopy = [...trace].map((p) => [...p]);

			const newSVG = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
			newSVG.setAttribute('width', '100%');
			newSVG.setAttribute('height', '100%');
			newSVG.setAttribute('viewBox', '0 0 2 1');
			newSVG.style.position = 'absolute';
			newSVG.style.top = '0';
			newSVG.style.left = '0';
			newSVG.style.zIndex = '2';
			this.target.appendChild(newSVG);

			const newPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
			newPath.setAttribute('fill', 'none');
			newPath.setAttribute('stroke', 'rgba(255, 230, 0, 0.5)');
			newPath.setAttribute('stroke-width', '.005');
			newPath.setAttribute('stroke-linecap', 'round');
			newSVG.appendChild(newPath);

			const drawNewPath = () => {
				const d = traceCopy
					.slice(currentFrom, currentTo + 1)
					.map((p, i) => {
						const [, x, y] = p as P;
						return `${i === 0 ? 'M' : 'L'} ${x * 2} ${y}`;
					})
					.join(' ');
				newPath.setAttribute('d', d);
			};

			const x = point[1];
			const y = point[2];
			const set = (x: number, y: number) => {
				const rect = this.target.getBoundingClientRect();
				const px = (x - rect.left) / rect.width;
				const py = (y - rect.top) / rect.height;
				point[1] = px;
				point[2] = py;
				end();
			};

			const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
			circle.setAttribute('cx', (x * 2).toString());
			circle.setAttribute('cy', y.toString());
			circle.setAttribute('r', '0.012');
			circle.setAttribute('fill', 'rgba(102, 255, 0, 0.5)');
			newSVG.appendChild(circle);

			const move = (x: number, y: number) => {
				const rect = this.target.getBoundingClientRect();
				const px = (x - rect.left) / rect.width;
				const py = (y - rect.top) / rect.height;

				circle.setAttribute('cx', (px * 2).toString());
				circle.setAttribute('cy', py.toString());
				traceCopy[index][1] = px;
				traceCopy[index][2] = py;
				drawNewPath();
			};

			const onmousedown = (e: MouseEvent) => {
				move(e.clientX, e.clientY);
			};
			const onmousemove = (e: MouseEvent) => {
				move(e.clientX, e.clientY);
			};
			const onmouseup = (e: MouseEvent) => {
				set(e.clientX, e.clientY);
			};
			const onleave = () => {
				end();
			};
			const onclick = (e: MouseEvent) => {
				set(e.clientX, e.clientY);
			};
			const ontouchstart = (e: TouchEvent) => {
				if (e.touches.length > 0) {
					move(e.touches[0].clientX, e.touches[0].clientY);
				}
			};
			const ontouchmove = (e: TouchEvent) => {
				if (e.touches.length > 0) {
					move(e.touches[0].clientX, e.touches[0].clientY);
				}
			};
			const ontouchend = (e: TouchEvent) => {
				if (e.changedTouches.length > 0) {
					set(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
				}
			};

			newSVG.addEventListener('mousedown', onmousedown);
			newSVG.addEventListener('mousemove', onmousemove);
			newSVG.addEventListener('mouseup', onmouseup);
			newSVG.addEventListener('click', onclick);
			newSVG.addEventListener('mouseleave', onleave);
			newSVG.addEventListener('touchstart', ontouchstart, { passive: false });
			newSVG.addEventListener('touchmove', ontouchmove, { passive: false });
			newSVG.addEventListener('touchend', ontouchend, { passive: false });

			const end = () => {
				this.svg.style.visibility = 'visible';
				for (const button of buttons) {
					button.style.visibility = 'visible';
				}
				newSVG.removeEventListener('mousedown', onmousedown);
				newSVG.removeEventListener('mousemove', onmousemove);
				newSVG.removeEventListener('mouseup', onmouseup);
				newSVG.removeEventListener('click', onclick);
				newSVG.removeEventListener('mouseleave', onleave);
				newSVG.removeEventListener('touchstart', ontouchstart);
				newSVG.removeEventListener('touchmove', ontouchmove);
				newSVG.removeEventListener('touchend', ontouchend);
				rerender();
			};

			this.svg.style.visibility = 'hidden';
			for (const button of buttons) {
				button.style.visibility = 'hidden';
			}

			return end;
		};

		const items: {
			show: () => void;
			hide: () => void;
			destroy: () => void;
		}[] = trace.map((point, i) => {
			const [, x, y, a] = point;
			if (a) {
				const btn = document.createElement('button');
				buttons.push(btn);
				btn.classList.add('btn', 'btn-primary', 'p-0', 'm-0', 'circle', 'hover-grow');
				btn.style.position = 'absolute';
				btn.style.height = '30px';
				btn.style.width = '30px';
				btn.style.zIndex = '200';
				btn.style.left = `${x * 100}%`;
				btn.style.top = `${y * 100}%`;
				btn.style.cursor = 'pointer';

				const onclick = (e: PointerEvent) => {
					contextmenu(e, {
						options: [
							'Action Options',
							`Action: ${this.app.config.yearInfo.actions[a] || a}`,
							`X: ${x.toFixed(3)}`,
							`Y: ${y.toFixed(3)}`,
							{
								name: 'Delete',
								icon: {
									type: 'material-icons',
									name: 'delete'
								},
								action: async () => {
									if (await confirm('Are you sure you want to delete this action?')) {
										trace[i][3] = 0;
										rerender();
									}
								}
							},
							{
								name: 'Change Action',
								icon: {
									type: 'material-icons',
									name: 'edit'
								},
								action: () => {
									const modal = rawModal('Change Action', [], (body) => {
										const editor = mount(ActionEditor, {
											target: body,
											props: {
												app: this.app,
												current: a
											}
										});

										editor.on('select', (newAction) => {
											trace[i][3] = newAction;
											modal.hide();
											rerender();
										});
										editor.on('cancel', () => {
											modal.hide();
										});

										return editor;
									});

									modal.show();
								}
							},
							{
								name: 'Move',
								icon: {
									type: 'material-icons',
									name: 'open_with'
								},
								action: () => {
									moveState(i);
								}
							},
							{
								name: 'Cancel',
								icon: {
									type: 'material-icons',
									name: 'close'
								},
								action: () => {}
							}
						],
						width: '150px'
					});
				};

				btn.addEventListener('click', onclick);

				const img = document.createElement('img');
				img.src = `/icons/${a}.png`;
				img.style.height = '100%';
				img.style.width = '100%';
				img.style.objectFit = 'contain';
				btn.appendChild(img);

				this.target.appendChild(btn);

				return {
					show: () => {
						btn.style.display = 'block';
					},
					hide: () => {
						btn.style.display = 'none';
					},
					destroy: () => {
						btn.removeEventListener('click', onclick);
						btn.remove();
					}
				};
			} else {
				const shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
				const px = flipX ? 1 - x : x;
				const py = flipY ? 1 - y : y;
				const nextPoint = trace[i + 1];
				const nx = nextPoint ? (flipX ? 1 - nextPoint[1] : nextPoint[1]) : px;
				const ny = nextPoint ? (flipY ? 1 - nextPoint[2] : nextPoint[2]) : py;
				const angle = Math.atan2(ny - py, (nx - px) * 2);
				const size = 0.015;
				// isosceles triangle points to clearly show direction, not equilateral
				const points = [
					[px * 2 + Math.cos(angle) * size, py + Math.sin(angle) * size],
					[
						px * 2 + Math.cos(angle + 120 * (Math.PI / 180)) * size,
						py + Math.sin(angle + 120 * (Math.PI / 180)) * size
					],
					[
						px * 2 + Math.cos(angle + 240 * (Math.PI / 180)) * size,
						py + Math.sin(angle + 240 * (Math.PI / 180)) * size
					]
				];
				shape.setAttribute('points', points.map((p) => p.join(' ')).join(', '));
				shape.setAttribute('fill', 'rgba(255, 0, 0, 0.5)');

				const onhover = () => {
					const PERCENT = 0.5;
					const hoverPoints = [
						[
							px * 2 + Math.cos(angle) * size * (1 + PERCENT),
							py + Math.sin(angle) * size * (1 + PERCENT)
						],
						[
							px * 2 + Math.cos(angle + 120 * (Math.PI / 180)) * size * (1 + PERCENT),
							py + Math.sin(angle + 120 * (Math.PI / 180)) * size * (1 + PERCENT)
						],
						[
							px * 2 + Math.cos(angle + 240 * (Math.PI / 180)) * size * (1 + PERCENT),
							py + Math.sin(angle + 240 * (Math.PI / 180)) * size * (1 + PERCENT)
						]
					];
					shape.setAttribute('points', hoverPoints.map((p) => p.join(' ')).join(', '));
				};

				const onleave = () => {
					shape.setAttribute('points', points.map((p) => p.join(' ')).join(', '));
				};

				shape.addEventListener('pointerenter', onhover);
				shape.addEventListener('pointerleave', onleave);
				const onclick = (e: PointerEvent) => {
					contextmenu(e, {
						options: [
							'Location Point',
							'X: ' + x.toFixed(3),
							'Y: ' + y.toFixed(3),
							{
								name: 'Add Action Here',
								icon: {
									type: 'material-icons',
									name: 'add'
								},
								action: () => {
									const modal = rawModal('Select Action', [], (body) => {
										const editor = mount(ActionEditor, {
											target: body,
											props: {
												app: this.app
											}
										});

										editor.on('select', (newAction) => {
											point[3] = newAction;
											modal.hide();
											rerender();
										});
										editor.on('cancel', () => {
											modal.hide();
										});

										return editor;
									});

									modal.show();
								}
							},
							{
								name: 'Move',
								icon: {
									type: 'material-icons',
									name: 'open_with'
								},
								action: () => {
									moveState(i);
								}
							},
							{
								name: 'Close',
								icon: {
									type: 'material-icons',
									name: 'close'
								},
								action: () => {}
							}
						],
						width: '200px'
					});
				};

				shape.addEventListener('click', onclick);
				removeListeners.push(() => {
					shape.removeEventListener('click', onclick);
					shape.removeEventListener('pointerenter', onhover);
					shape.removeEventListener('pointerleave', onleave);
				});

				this.svg.appendChild(shape);

				return {
					show: () => {
						shape.style.display = 'block';
					},
					hide: () => {
						shape.style.display = 'none';
					},
					destroy: () => {
						shape.removeEventListener('click', onclick);
						shape.removeEventListener('pointerenter', onhover);
						shape.removeEventListener('pointerleave', onleave);
						shape.remove();
					}
				};
			}
		});

		this.destroy = () => {
			for (const remove of removeListeners) {
				remove();
			}
			for (const item of items) {
				item.destroy();
			}
			this.target.innerHTML = '';
			this.svg.innerHTML = '';
			const cleanupRange = this.rangeUnsub;
			const cleanupSliderSub = this.sliderUnsub;
			const cleanupSlider = this.sliderCleanup;
			this.rangeUnsub = () => {};
			this.sliderUnsub = () => {};
			this.sliderCleanup = () => {};
			cleanupRange();
			cleanupSliderSub();
			cleanupSlider();
			this.sliderEl?.remove();
			this.sliderEl = undefined;
		};

		let onreset = () => {};

		const applyRange = (from: number, to: number) => {
			const safeFrom = Math.max(0, Math.min(from, trace.length - 1));
			const safeTo = Math.max(safeFrom, Math.min(to, trace.length - 1));
			showPath(safeFrom, safeTo);
			for (const item of items) {
				item.hide();
			}
			for (let i = safeFrom; i <= safeTo; i++) {
				items[i]?.show();
			}
		};

		this.sliderEl = document.createElement('div');
		this.sliderEl.className = 'slider-container my-2';
		if (this.target.parentElement) {
			this.target.parentElement.append(this.sliderEl);
		}

		const slider = new RangeSlider({
			min: 0,
			max: maxIndex,
			target: this.sliderEl,
			step: 1,
			init: [this.data.from, this.data.to]
		});
		this.sliderUnsub = slider.subscribe(({ min, max }) => {
			this.set({ from: min, to: max });
		});
		this.sliderCleanup = slider.render();
		this.rangeUnsub = this.subscribe(({ from, to }) => {
			applyRange(from, to);
		});

		const returnObj = {
			onreset: (cb: () => void) => {
				onreset = cb;
			},
			view: (from: number, to: number) => {
				this.set({ from, to });
			}
		};

		return returnObj;
	}

	destroy = () => {};

	commit() {
		this.app.state.removeActionStates();

		for (const [i, x, y, a] of this.trace) {
			const toSet = this.app.state.ticks.data.find((t) => t.index === i);
			if (!toSet) continue; // should never happen
			if (a) {
				toSet.action = a;
			}
			toSet.point = [x, y];
		}

		this.app.contribution.render();
	}
}
