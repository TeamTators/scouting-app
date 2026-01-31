import type { CompLevel } from 'tatorscout/tba';
import { MatchData } from './match-data';
import { Tick } from './tick';
import { AppState } from './state';
import { AppView } from './view';
import { EventEmitter } from 'ts-utils/event-emitter';
import type { Point2D } from 'math/point';
import { Loop } from 'ts-utils/loop';
import { ActionState, type AppObject } from './app-object';
import { Checks } from './checks';
import { AppData } from './data-pull';
import { writable } from 'svelte/store';
import { attemptAsync } from 'ts-utils/check';
import { globalData } from './global-data.svelte';
import type { CompressedMatchSchemaType } from '$lib/types/match';
import { Comments } from './comments';
import { Trace } from 'tatorscout/trace';
// import { ScoreCorrection } from './score-correction';
import type { YearInfo } from 'tatorscout/years';
import { ScoreContribution } from './score-contribution';
import { Canvas } from 'canvas/canvas';
import { Circle } from 'canvas/circle';
import { Polygon } from 'canvas/polygon';
import { Color } from 'colors/color';
import { Img } from 'canvas/image';

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
		reset: undefined;
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
	// public readonly scoreCorrection: ScoreCorrection;
	public readonly contribution: ScoreContribution;
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
			yearInfo: YearInfo;
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
		this.contribution = new ScoreContribution(this);
		// this.scoreCorrection = new ScoreCorrection(this);
	}

	serialize() {
		return attemptAsync<CompressedMatchSchemaType>(async () => {
			const trace = Trace.parse(this.state.traceArray()).unwrap();
			const { checks, sliders } = this.checks.serialize();
			const comments = this.comments.serialize();
			const { eventKey, compLevel, match, team } = this.matchData.data;
			const { scout, prescouting, practice, flipX, flipY } = globalData;
			const { alliance } = this.matchData;
			let group = -1;
			const g = await this.matchData.getScoutGroup();
			if (g.isOk() && g.value !== null) group = g.value;

			return {
				trace: trace.serialize(true),
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
				sliders
				// scoreCorrection: this.scoreCorrection.serialize(),
			};
		});
	}

	init(target: HTMLElement) {
		this.state.init();
		this.comments.init();
		this.view.init(target);
		this.matchData.init();
	}

	// resets all stored data in the app
	reset() {
		this.state.init();
		this.comments.reset();
		this.checks.reset();
		this.view.reset();
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
			// loop.destroyEvents();
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
			this.state.tick?.setActionState(
				new ActionState({
					object: config.object as AppObject<unknown>,
					state: config.object.state,
					point: this.state.currentLocation || [0, 0]
				}) as ActionState<unknown>,
				config.alliance
			);
		};

		// if the button is held down, change the state
		let timeout: ReturnType<typeof setTimeout> | undefined = undefined;
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
		if (!Number.isInteger(sigFigs))
			throw new Error('Cannot have non-integer number of sig figs. Recieved: ' + sigFigs);
		console.log(`Click points enabled.
To reset points: ctrl + r
To view points: ctrl + v
To disable: ctrl + d`);
		if (!Number.isInteger(sigFigs))
			throw new Error('Cannot have non-integer number of sig figs. Recieved: ' + sigFigs);

		const target = this.view.target;
		if (!target) {
			console.warn('No target element for click points.');
			return;
		}

		const cvs = document.createElement('canvas');
		cvs.style.width = '100%';
		cvs.style.height = '100%';
		cvs.width = 2000; //cvs.clientWidth;
		cvs.height = 1000; //cvs.clientHeight;
		cvs.style.position = 'absolute';
		cvs.style.top = '0';
		cvs.style.left = '0';
		const ctx = cvs.getContext('2d');
		if (!ctx) return;

		const canvas = new Canvas(ctx);

		const img = new Img(`/assets/fields/${this.config.year}.png`);
		img.width = 1;
		img.height = 1;
		canvas.add(img);

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
			canvas.remove(...drawables);
			shape.points = [];
			drawables = [];
		};
		const add = (point: Point2D) => {
			points.push([point[0].toFixed(sigFigs), point[1].toFixed(sigFigs)]);
			const circle = new Circle(point, 0.003);
			drawables.push(circle);
			canvas.add(circle);
			shape.points.push(point);
		};
		const view = () => {
			console.log(`[
    ${points.map((p) => `[${p[0]}, ${p[1]}]`).join(',\n    ')}
]`);
		};

		const onclick = (e: MouseEvent) => {
			const rect = target.getBoundingClientRect();
			const x = (e.clientX - rect.left) / rect.width;
			const y = (e.clientY - rect.top) / rect.height;
			add([x, y]);
		};

		document.addEventListener('keydown', (e) => {
			if (e.ctrlKey) {
				e.preventDefault();
				if (e.key === 'e') enable();
				else if (enabled) {
					switch (e.key) {
						case 'r':
							reset();
							break;
						case 'v':
							view();
							break;
						case 'd':
							disable();
							break;
						case 'e':
							enable();
							break;
					}
				}
			}
		});

		let enabled = false;

		let stop = () => {};

		const enable = () => {
			target.appendChild(cvs);
			stop = canvas.animate();
			enabled = true;
			console.log('Click points enabled. Press ctrl + d to disable.');
			target.addEventListener('click', onclick);
		};

		const disable = () => {
			stop();
			target.removeChild(cvs);
			enabled = false;
			console.log('Click points disabled. Press ctrl + e to enable.');
			target.removeEventListener('click', onclick);
		};

		console.log('Click points disabled. Press ctrl + e to enable.');
	}

	submit() {
		return attemptAsync(async () => {
			const serialized = (await this.serialize()).unwrap();
			(await AppData.submitMatch(serialized, true)).unwrap();
			// I have a feeling this is not needed. the reset function is called from the svelte file, this just makes it get called twice.
			// this.reset();
		});
	}
}
