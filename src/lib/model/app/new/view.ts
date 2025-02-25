import { Canvas } from 'canvas/canvas';
import type { App } from './app';
import { Path } from 'canvas/path';
import { Border } from 'canvas/border';
import { Timer } from './timer';
import { Img } from 'canvas/image';
import { Color } from 'colors/color';
import { ShortPath } from './short-path';
import { sleep } from 'ts-utils/sleep';
import { Polygon } from 'canvas/polygon';
import type { Point2D } from 'math/point';
import { browser } from '$app/environment';

export class AppView {
	public readonly ctx: CanvasRenderingContext2D | undefined;
	public readonly canvas: Canvas | undefined;
	public canvasEl: HTMLCanvasElement | undefined;
	public readonly path = new ShortPath(50);
	public readonly border = new Border([]);
	public readonly timer: Timer;
	public readonly background: Img | undefined;
	public readonly areas: Polygon[] = [];

	public drawing = false;
	public clicking = false;

	private _target: HTMLElement | undefined;

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
		}
	}

	init(target: HTMLElement) {
		if (!this.canvasEl) return () => {};
		const canvas = this.canvas;
		if (!canvas) return () => {};
		this._target = target;
		target.innerHTML = '';
		target.style.position = 'relative';
		// this.canvasEl.style.objectFit = 'contain';
		this.canvasEl.style.position = 'absolute';
		target.appendChild(this.canvasEl);
		this.timer.init(target);

		let timeout: NodeJS.Timeout;

		// Set up listeners:
		const push = (x: number, y: number) => {
			if (!this.drawing) return;
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
			push(x, y);
		};
		const move = (x: number, y: number) => {
			if (this.clicking) return;
			push(x, y);
		};
		const up = (x: number, y: number) => {
			if (this.clicking) return;
			this.drawing = false;
			push(x, y);
			this.app.state.currentLocation = null;
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

		this.canvas.add(this.border, this.path);

		return () => {
			if (!this.canvasEl) return;
			if (!this.canvas) return;
			// destroys event listeners
			const newEl = this.canvasEl.cloneNode(true) as HTMLCanvasElement;
			this.canvasEl.parentNode?.replaceChild(newEl, this.canvasEl);
			this.canvas.destroy();
		};
	}

	setView() {
		if (!this.canvas) return;
		const target = this._target;
		if (!target) return console.warn('No target set');

		let xOffset = 0;
		let yOffset = 0;

		if (target.clientWidth > target.clientHeight * 2) {
			xOffset = (target.clientWidth - target.clientHeight * 2) / 2;
			this.canvas.ctx.canvas.width = target.clientHeight * 2;
			this.canvas.ctx.canvas.height = target.clientHeight;
		} else {
			yOffset = (target.clientHeight - target.clientWidth / 2) / 2;
			this.canvas.ctx.canvas.width = target.clientWidth;
			this.canvas.ctx.canvas.height = target.clientWidth / 2;
		}
		this.canvas.ctx.canvas.style.top = `${yOffset}px`;
		this.canvas.ctx.canvas.style.left = `${xOffset}px`;

		for (const o of this.app.gameObjects) {
			const { element, viewCondition } = o;
			let [x, y] = o.point;
			x = this.app.config.flipY ? 1 - x : x;
			y = this.app.config.flipX ? 1 - y : y;

			element.style.left = `${x * this.canvas.width + xOffset}px`;
			element.style.top = `${y * this.canvas.height + yOffset}px`;

			if (viewCondition && this.app.state.tick) {
				if (viewCondition(this.app.state.tick)) {
					element.style.display = 'block';
				} else {
					element.style.display = 'none';
				}
			}
		}
	}

	start() {
		if (!this.canvas) return;
		console.log('Starting: ', this.canvas);
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
		condition: (shape: Polygon) => boolean;
	}) {
		const p = new Polygon(config.points);
		if (!this.canvas) return p;

		p.properties.doDraw = () => config.condition(p);
		p.properties.fill = {
			color: config.color.toString('rgba')
		};
		p.properties.line = {
			color: 'transparent'
		};

		p.fade(5);

		this.canvas.add(p);
		this.areas.push(p);

		return p;
	}
}
