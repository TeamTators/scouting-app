import { Canvas } from 'canvas/canvas';
import type { App } from './app';
import { Border } from 'canvas/border';
import { Timer } from './timer';
import { Img } from 'canvas/image';
import { Color } from 'colors/color';
import { ShortPath } from './short-path';
import { sleep } from 'ts-utils/sleep';
import type { Point2D } from 'math/point';
import { browser } from '$app/environment';
import { ButtonCircle } from './button-circle';
import { globalData } from './global-data.svelte';
import { Zone } from './zone';
import { mount, unmount } from 'svelte';
import Cover from '$lib/components/app/Cover.svelte';

export class AppView {
	public readonly ctx: CanvasRenderingContext2D | undefined;
	public readonly canvas: Canvas | undefined;
	public canvasEl: HTMLCanvasElement | undefined;
	public readonly path = new ShortPath(50);
	public readonly border = new Border([]);
	public readonly timer: Timer;
	public readonly background: Img | undefined;
	public readonly areas: Zone[] = [];
	public readonly buttonCircle: ButtonCircle;

	public drawing = false;
	public clicking = false;

	public target: HTMLElement | undefined;

	constructor(public readonly app: App) {
		this.timer = new Timer(app);

		this.canvasEl = browser ? document.createElement('canvas') : undefined;
		const ctx = this.canvasEl?.getContext('2d');
		// if (!ctx) throw new Error('Could not get 2D context');
		if (ctx) {
			this.ctx = ctx;
			this.canvas = new Canvas(ctx, {
				events: ['click', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'touchcancel']
			});
			this.canvas.adaptable = true;
			this.canvas.ratio = 2;

			this.background = new Img(`/fields/${this.app.config.year}.png`, {
				x: 0,
				y: 0,
				width: 1,
				height: 1
			});

			this.border.properties.doDraw = () =>
				this.app.state.currentLocation ? this.border.isIn(this.app.state.currentLocation) : false;
			this.border.properties.fill = {
				color: new Color('red').setAlpha(0.5).toString('rgba')
			};

			this.path.properties.line = {
				color: 'yellow'
			};
		}

		this.buttonCircle = new ButtonCircle(this.app);
	}

	init(target: HTMLElement) {
		if (!this.canvasEl) return () => {};
		const canvas = this.canvas;
		if (!canvas) return () => {};
		canvas.height = 500;
		canvas.width = 1000;

		const coverContainer = document.createElement('div');

		const cover = mount(Cover, {
			target: coverContainer,
			props: {
				app: this.app,
				scout: globalData.scout
			}
		});

		if (this.app.matchData.alliance === null) console.error('alliance value is null');

		coverContainer.style.position = 'absolute';
		coverContainer.style.width = '100vw';
		coverContainer.style.height = '100vh';
		coverContainer.style.zIndex = '200';
		coverContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';

		const transferStart = (e: MouseEvent | TouchEvent) => {
			coverContainer.removeEventListener('mousedown', transferStart);
			coverContainer.removeEventListener('touchstart', transferStart);
			unmount(cover);
			coverContainer.remove();

			this.app.start();

			if (e instanceof MouseEvent) {
				this.canvasEl?.dispatchEvent(new MouseEvent('mousedown', e));
			}

			if (e instanceof TouchEvent) {
				this.canvasEl?.dispatchEvent(
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
			this.canvasEl?.dispatchEvent(
				new TouchEvent('touchmove', {
					touches: Array.from(e.touches),
					targetTouches: Array.from(e.targetTouches),
					changedTouches: Array.from(e.changedTouches),
					composed: e.composed
				})
			);
		};

		const transferEnd = (e: TouchEvent) => {
			this.canvasEl?.dispatchEvent(
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

		this.target = target;
		target.innerHTML = '';
		target.style.position = 'relative';
		this.canvasEl.style.position = 'absolute';
		target.appendChild(this.canvasEl);
		target.appendChild(coverContainer);
		for (const object of this.app.gameObjects) {
			target.appendChild(object.element);
		}
		this.timer.init(target);

		let timeout: NodeJS.Timeout;

		// Set up listeners:
		const push = (x: number, y: number) => {
			if (!this.drawing) return;
			if (x < 0 || y < 0) return;
			this.path.add([x, y]);
			this.app.state.currentLocation = [x, y];
			if (timeout) clearTimeout(timeout);

			// TODO: This may cause some performance issues
			timeout = setTimeout(async () => {
				while (this.path.points.length !== 0) {
					await sleep(10);
					this.path.points.shift();
				}
			}, 500);
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
		this.canvasEl.addEventListener('mousedown', (e) => {
			// e.preventDefault();
			const [[x, y]] = canvas.getXY(e);
			down(x, y);
		});

		this.canvasEl.addEventListener('mousemove', (e) => {
			// e.preventDefault();

			const [[x, y]] = canvas.getXY(e);
			move(x, y);
		});

		this.canvasEl.addEventListener('mouseup', (e) => {
			// e.preventDefault();

			const [[x, y]] = canvas.getXY(e);
			up(x, y);
		});

		this.canvasEl.addEventListener('touchstart', (e) => {
			// e.preventDefault();

			const [[x, y]] = canvas.getXY(e);
			down(x, y);
		});

		this.canvasEl.addEventListener('touchmove', (e) => {
			e.preventDefault();

			const [[x, y]] = canvas.getXY(e);
			move(x, y);
		});

		this.canvasEl.addEventListener('touchend', (_e) => {
			// e.preventDefault();

			this.drawing = false;
			// const [[x, y]] = this.canvas.getXY(e);
			// up(x, y);
		});

		this.canvasEl.addEventListener('touchcancel', (e) => {
			e.preventDefault();

			this.drawing = false;
			// const [[x, y]] = this.canvas.getXY(e);
			// up(x, y);
		});

		if (this.background) this.canvas.add(this.background);

		this.canvas.add(this.border, this.path, ...this.areas, this.buttonCircle);

		this.setView();
		const offButtonCircle = this.buttonCircle.init(target);

		const offAnimate = this.app.on('action', ({ action, point, alliance }) => {
			this.animateIcon(action, point, alliance);
		});

		return () => {
			if (!this.canvasEl) return;
			if (!this.canvas) return;
			// destroys event listeners
			const newEl = this.canvasEl.cloneNode(true) as HTMLCanvasElement;
			this.canvasEl.parentNode?.replaceChild(newEl, this.canvasEl);
			this.canvas.destroy();
			offAnimate();
			offButtonCircle();
			try {
				unmount(cover);
			} catch {
				// do nothing
			}
		};
	}

	public xOffset = 0;
	public yOffset = 1;

	setView() {
		if (!this.canvas) return;
		const target = this.target;
		if (!target) return console.warn('No target set');
		const alliance = this.app.matchData.alliance;

		this.xOffset = 0;
		this.yOffset = 0;

		if (target.clientWidth > target.clientHeight * 2) {
			this.xOffset = (target.clientWidth - target.clientHeight * 2) / 2;
			this.canvas.ctx.canvas.width = target.clientHeight * 2;
			this.canvas.ctx.canvas.height = target.clientHeight;
		} else {
			this.yOffset = (target.clientHeight - target.clientWidth / 2) / 2;
			this.canvas.ctx.canvas.width = target.clientWidth;
			this.canvas.ctx.canvas.height = target.clientWidth / 2;
		}
		this.canvas.ctx.canvas.style.top = `${this.yOffset}px`;
		this.canvas.ctx.canvas.style.left = `${this.xOffset}px`;

		if (this.background) {
			this.background.mirror.x = globalData.flipY;
			this.background.mirror.y = globalData.flipX;
		}

		for (const o of this.app.gameObjects) {
			const { element, viewCondition, staticX, staticY } = o;
			let [x, y] = o.point;
			if (!staticY) x = globalData.flipY ? 1 - x : x;
			if (!staticX) y = globalData.flipX ? 1 - y : y;

			element.style.left = `${x * this.canvas.width + this.xOffset}px`;
			element.style.top = `${y * this.canvas.height + this.yOffset}px`;

			if (viewCondition && this.app.state.tick) {
				if (viewCondition(this.app.state.tick)) {
					element.style.display = 'block';
				} else {
					element.style.display = 'none';
				}
			}

			if (alliance && o.alliance) {
				if (alliance === o.alliance) {
					element.style.display = 'block';
				} else {
					element.style.display = 'none';
				}
			} else {
				element.style.display = 'block';
			}
		}

		for (const button of this.buttonCircle.buttons) {
			if (button.el) button.el.style.display = 'none';
		}
	}

	start() {
		if (!this.canvas) return () => {};
		const view = () => {
			this.setView();
			requestAnimationFrame(view);
		};
		requestAnimationFrame(view);
		return this.canvas.animate();
	}

	setBorder(points: Point2D[]) {
		this.border.points = points;
		return this.border;
	}

	addArea(config: {
		zone: string;
		points: Point2D[];
		color: Color;
		condition: (shape: Zone) => boolean;
	}) {
		const p = new Zone(this.app, config.points);
		if (!this.canvas) return p;

		p.properties.doDraw = () => config.condition(p);
		p.properties.fill = {
			color: config.color.toString('rgba')
		};
		p.properties.line = {
			color: 'transparent'
		};

		p.fade(5);

		this.areas.push(p);

		return p;
	}

	animateIcon(icon: string, position: Point2D, alliance: 'red' | 'blue' | null) {
		if (!browser) return;
		if (!this.canvas) return;
		const img = document.createElement('img');
		img.src = `/icons/${icon}.png`;
		img.style.position = 'absolute';
		img.style.transform = 'translate(-50%, -50%) !important;';
		img.style.height = '25px';
		img.style.width = '25px';
		img.style.zIndex = '200';
		const [x, y] = position;
		img.style.left = `${x * this.canvas.width + this.xOffset}px`;
		img.style.top = `${y * this.canvas.height + this.yOffset}px`;
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
