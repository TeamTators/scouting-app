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
import { ButtonCircle } from './button-circle';

export class AppView {
	public readonly ctx: CanvasRenderingContext2D | undefined;
	public readonly canvas: Canvas | undefined;
	public canvasEl: HTMLCanvasElement | undefined;
	public readonly path = new ShortPath(50);
	public readonly border = new Border([]);
	public readonly timer: Timer;
	public readonly background: Img | undefined;
	public readonly areas: Polygon[] = [];
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
		}

		this.buttonCircle = new ButtonCircle(this.app);
	}

	init(target: HTMLElement) {
		if (!this.canvasEl) return () => {};
		const canvas = this.canvas;
		if (!canvas) return () => {};
		canvas.height = 500;
		canvas.width = 1000;

		const cover = document.createElement('div');
		cover.innerHTML = `
			<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; font-size: 2em;">
				Start tracing to start match <span class="text-info">${this.app.matchData.compLevel}${this.app.matchData.match}</span> for team <span class="text-info">${this.app.matchData.team}</span> <span class="text-info team-name"></span>
			</div>
		`;

		this.app.matchData.getEvent().then((e) => {
			if (e.isErr()) return console.error(e.error);
			const team = e.value.teams.find((t) => t.team_number === this.app.matchData.team);
			if (!team) return;
			const el = cover.querySelector('.team-name');
			if (el) el.textContent = team.nickname;
		});

		cover.style.position = 'absolute';
		cover.style.width = '100vw';
		cover.style.height = '100vh';
		cover.style.zIndex = '200';
		cover.style.backgroundColor = 'black';
		cover.style.opacity = '0.5';
		const removeCover = (e: MouseEvent | TouchEvent) => {
			if (e instanceof MouseEvent) {
				canvas.ctx.canvas.dispatchEvent(new MouseEvent('mousedown', { ...e }));
			}
			if (e instanceof TouchEvent) {
				canvas.ctx.canvas.dispatchEvent(
					new TouchEvent('touchstart', {
						touches: [
							{
								...e.touches[0]
							}
						]
					})
				);
			}

			target.removeChild(cover);
			cover.remove();
			this.app.start();
		};
		cover.onmousedown = removeCover;
		cover.onclick = removeCover;
		cover.ontouchstart = removeCover;

		this.target = target;
		target.innerHTML = '';
		target.style.position = 'relative';
		// this.canvasEl.style.objectFit = 'contain';
		this.canvasEl.style.position = 'absolute';
		target.appendChild(this.canvasEl);
		target.appendChild(cover);
		for (const object of this.app.gameObjects) {
			target.appendChild(object.element);
		}
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

		for (const o of this.app.gameObjects) {
			const { element, viewCondition } = o;
			let [x, y] = o.point;
			x = this.app.config.flipY ? 1 - x : x;
			y = this.app.config.flipX ? 1 - y : y;

			element.style.left = `${x * this.canvas.width + this.xOffset}px`;
			element.style.top = `${y * this.canvas.height + this.yOffset}px`;

			if (viewCondition && this.app.state.tick) {
				if (viewCondition(this.app.state.tick)) {
					element.style.display = 'block';
				} else {
					element.style.display = 'none';
				}
			}

			if (alliance) {
				if (alliance === o.alliance) {
					element.style.display = 'block';
				} else {
					element.style.display = 'none';
				}
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
