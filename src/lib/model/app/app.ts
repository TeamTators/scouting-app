import type { CompLevel } from 'tatorscout/tba';
import { MatchData } from './match-data';
import { Tick } from './tick';
import { AppState } from './state';
import { AppView } from './view';
import { EventEmitter } from 'ts-utils/event-emitter';
import type { Point2D } from 'math/point';
import { Loop } from 'ts-utils/loop';
import { ActionState, type AppObject } from './app-object';
import { browser } from '$app/environment';
import { Circle } from 'canvas/circle';
import { Polygon } from 'canvas/polygon';
import { Color } from 'colors/color';
import { Checks } from './checks';
import { AppData } from './data-pull';
import { writable } from 'svelte/store';
import { attemptAsync } from 'ts-utils/check';
import { globalData } from './global-data.svelte';
import type { MatchSchemaType } from '$lib/types/match';
import { Comments } from './comments';

export const TICKS_PER_SECOND = 4;
export const SECTIONS = {
	auto: [0, 15],
	teleop: [16, 135],
	endgame: [136, 150],
	end: [151, 160]
};
export type Section = 'auto' | 'teleop' | 'endgame' | 'end';
export const TICK_DURATION = 1000 / TICKS_PER_SECOND;
export const TOTAL_TICKS = TICKS_PER_SECOND * 160;

export class App {
	private readonly emitter = new EventEmitter<{
		tick: Tick;
		section: Section;
		action: {
			action: string;
			point: Point2D;
			alliance: 'red' | 'blue' | null;
		};
		second: number;
		stopped: undefined;
		end: undefined;
		stop: undefined;
		pause: undefined;
		resume: undefined;
		error: Error;
	}>();

	public readonly on = this.emitter.on.bind(this.emitter);
	public readonly off = this.emitter.off.bind(this.emitter);
	public readonly once = this.emitter.once.bind(this.emitter);
	public readonly emit = this.emitter.emit.bind(this.emitter);

	public readonly matchData: MatchData;
	public readonly state: AppState;
	public readonly view: AppView;
	public readonly checks: Checks;
	public readonly comments: Comments;
	public readonly gameObjects: {
		point: Point2D;
		object: AppObject;
		element: HTMLElement;
		alliance: 'red' | 'blue' | null;
		viewCondition?: (tick: Tick) => boolean;
		staticX: boolean;
		staticY: boolean;
	}[] = [];
	public readonly running = writable(false);

	constructor(
		public readonly config: Readonly<{
			year: number;
			eventKey: string;
			match: number;
			compLevel: CompLevel;
			team: number;
			alliance: 'red' | 'blue' | null;
		}>
	) {
		this.matchData = new MatchData(
			this,
			config.eventKey,
			config.compLevel,
			config.match,
			config.team,
			config.alliance
		);

		this.state = new AppState(this);
		this.view = new AppView(this);
		this.checks = new Checks(this);
		this.comments = new Comments(this);
	}

	serialize() {
		return attemptAsync<MatchSchemaType>(async () => {
			const trace = this.state.serialize();
			const { checks, sliders, } = this.checks.serialize();
			const comments = this.comments.serialize();
			const { eventKey, compLevel, match, team } = this.matchData.data;
			const { scout, prescouting, practice, flipX, flipY } = globalData;
			const { alliance } = this.matchData;
			let group = -1;
			const g = await this.matchData.getScoutGroup();
			if (g.isOk() && g.value !== null) group = g.value;

			return {
				trace,
				checks,
				comments,
				eventKey,
				compLevel,
				match,
				team,
				flipX,
				flipY,
				scout,
				prescouting,
				practice,
				alliance,
				group,
				sliders,
			};
		});
	}

	private _offState = () => {};
	private _offView = () => {};
	private _offData = () => {};
	private _offCollected = () => {};
	private _offComments = () => {};
	private _target: HTMLElement | undefined;

	private _deinit = () => {};

	init(target: HTMLElement) {
		this._target = target;
		this._offState = this.state.init();
		this._offData = this.matchData.init();
		this._offCollected = this.checks.init();
		this._offComments = this.comments.init();
		this._offView = this.view.init(target);

		this._deinit = () => {
			this._offState();
			this._offView();
			this._offData();
			this._offCollected();
			this._offComments();
		};

		return this._deinit;
	}

	// Main event loop
	start(cb?: (tick: Tick) => void) {
		let prevSection: Section | null = null;
		this.state.currentIndex = 0;
		this.running.set(true);

		const loop = new Loop(() => {
			const currentIndex = this.state.currentIndex;
			// console.log('index', currentIndex);
			const { section } = this.state;
			if (prevSection !== section && section) this.emit('section', section);
			prevSection = section;
			const tick = this.state.tick;
			if (!tick) {
				this.emit('end', undefined);
				return fullStop();
			}

			if (!loop.active) {
				return;
			}
			this.emit('tick', tick);
			if (this.state.currentLocation) {
				tick.point = this.state.currentLocation;
			}

			if (currentIndex % TICKS_PER_SECOND === 0) {
				this.emit('second', parseInt(String(currentIndex / TICKS_PER_SECOND)));
			}

			if (cb) {
				try {
					const s = Date.now();
					cb(tick);
					if (Date.now() - s > TICK_DURATION) {
						console.warn('Callback function takes a long time.');
					}
				} catch (err) {
					this.emit('error', err as Error);
					return this.stop();
				}
			}

			this.state.currentIndex++;
		}, TICK_DURATION);

		loop.start();

		const pause = () => {
			const resume = () => {
				this.on('pause', pause);
				this.off('resume', resume);
				this.running.set(true);
				loop.start();
			};
			this.running.set(false);
			this.on('resume', resume);
			this.off('pause', pause);
			loop.stop();
			loop['em'].destroyEvents();
		};
		this.on('pause', pause);

		const fullStop = () => {
			loop.stop();
			this.running.set(false);
			this.state.currentIndex = -1;
			this.off('stop', fullStop);
		};

		this.on('stop', fullStop);

		return fullStop;
	}

	animate() {
		return this.view.start();
	}

	stop() {
		this.state.currentIndex = -1;
		this.view.timer.set({
			section: null,
			second: -1,
			index: -1
		});
		this.emit('stop', undefined);
	}

	pause() {
		this.emit('pause', undefined);
	}

	resume() {
		if (this.state.currentIndex !== -1) return this.emit('resume', undefined);
		return this.start();
	}

	reset() {
		this._offState();
		this._offCollected();
		if (this._target) this.init(this._target);
	}

	goto(section: Section) {
		const [start] = SECTIONS[section];
		this.state.currentIndex = start * TICKS_PER_SECOND;
		const tick = this.state.tick;
		if (!tick) return;
		this.emit('tick', tick);
		this.view.timer.set({
			section,
			second: start,
			index: start * TICKS_PER_SECOND
		});
	}

	gotoTickIndex(index: number) {
		if (index < 0) index = 0;
		if (index > TOTAL_TICKS) index = TOTAL_TICKS;
		this.state.currentIndex = index;
		const tick = this.state.tick;
		if (!tick) return;
		this.emit('tick', tick);
		this.view.timer.set({
			section: this.state.section,
			second: parseInt(String(index / TICKS_PER_SECOND)),
			index
		});
	}

	addAppObject<T = unknown>(config: {
		point: Point2D;
		object: AppObject<T>;
		button: HTMLElement;
		convert?: (state: T) => string;
		alliance: 'red' | 'blue' | null;
		viewCondition?: (tick: Tick) => boolean;
		staticX: boolean;
		staticY: boolean;
	}) {
		this.gameObjects.push({
			point: config.point,
			object: config.object as AppObject<unknown>,
			element: config.button,
			alliance: config.alliance,
			viewCondition: config.viewCondition,
			staticX: config.staticX,
			staticY: config.staticY
		});

		if (!config.button.innerHTML) config.button.innerText = config.object.config.name;
		const defaultHTML = config.button.innerHTML;
		config.button.style.position = 'absolute';
		config.button.style.zIndex = '100';
		config.button.style.transform = 'translate(-50%, -50%)';

		config.object.on('change', (state) => {
			if (!state.state) {
				config.button.innerHTML = defaultHTML;
				return;
			}

			const content = String(config.convert ? config.convert(state.state) : state.state);

			config.button.innerHTML = `${defaultHTML}: ${content}`;
		});

		config.button.onclick = () => {
			config.object.update(this.state.currentLocation ?? undefined);
			this.emit('action', {
				action: config.object.config.abbr,
				alliance: config.alliance,
				point: this.state.currentLocation || [0, 0]
			});
			this.state.tick?.set(
				new ActionState({
					object: config.object as AppObject<unknown>,
					state: config.object.state,
					point: this.state.currentLocation || [0, 0]
				}) as ActionState<unknown>
			);
		};

		// if the button is held down, change the state
		let timeout: NodeJS.Timeout | undefined = undefined;
		const start = () => {
			if (timeout) end();
			timeout = setTimeout(() => {
				config.object.undo();
			}, 500);
		};
		const end = () => {
			if (timeout) clearTimeout(timeout);
		};

		config.button.addEventListener('contextmenu', (e) => {
			e.preventDefault();
		});

		config.button.addEventListener('mousedown', start);
		config.button.addEventListener('touchstart', start);
		config.button.addEventListener('mouseup', end);
		config.button.addEventListener('touchend', end);
		config.button.addEventListener('touchcancel', end);
		config.button.addEventListener('mouseleave', end);
		config.button.addEventListener('touchleave', end);
	}

	clickPoints(sigFigs: number) {
		if (!browser) return;
		const canvas = this.view.canvas;
		if (!canvas) return;
		const enable = () => {
			console.log(`Enabling click points.
To reset points: ctrl + r
To view points: ctrl + v
To disable: ctrl + d`);
			if (!Number.isInteger(sigFigs))
				throw new Error('Cannot have non-integer number of sig figs. Recieved: ' + sigFigs);
			let points: [string, string][] = [];
			let drawables: Circle[] = [];
			const shape = new Polygon([]);
			shape.fill = {
				color: Color.fromName('gray').setAlpha(0.75).toString('rgba')
			};
			shape.line = {
				color: 'transparent'
			};
			canvas.add(shape);
			const reset = () => {
				points = [];
				canvas.remove(...drawables, shape);
				drawables = [];
			};
			const add = (point: Point2D) => {
				points.push([point[0].toFixed(sigFigs), point[1].toFixed(sigFigs)]);
				const circle = new Circle(point, 0.01);
				drawables.push(circle);
				canvas.add(circle);
				shape.points.push(point);
			};
			const view = () => {
				console.log(`[
    ${points.map((p) => `[${p[0]}, ${p[1]}]`).join(',\n    ')}
]`);
			};

			canvas.on('click', (e) => {
				const [point] = e.points;
				add(point);
			});

			const keydown = (e: KeyboardEvent) => {
				// console.log('Keydown:', {
				//     shift: e.shiftKey,
				//     ctrl: e.ctrlKey,
				//     key: e.key,
				// })
				if (e.ctrlKey) {
					switch (e.key) {
						case 'r':
							e.preventDefault();
							reset();
							break;
						case 'v':
							e.preventDefault();
							view();
							break;
						case 'd':
							e.preventDefault();
							console.log('Click points disabled.');
							document.removeEventListener('keydown', keydown);
							reset();
							canvas.remove(shape);
							enabler();
							break;
					}
				}
			};

			document.addEventListener('keydown', keydown);
		};

		const enabler = () => {
			console.log('Click points allowed, press ctrl + e to enable');

			const keydownEnable = (e: KeyboardEvent) => {
				if (e.ctrlKey && e.key === 'e') {
					e.preventDefault();
					enable();
					document.removeEventListener('keydown', keydownEnable);
				}
			};
			document.addEventListener('keydown', keydownEnable);
		};

		enabler();
	}

	submit() {
		return attemptAsync(async () => {
			const serialized = (await this.serialize()).unwrap();
			(await AppData.submitMatch(serialized, true)).unwrap();
			this.reset();
		});
	}
}
