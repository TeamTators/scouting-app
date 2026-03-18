/**
 * @fileoverview Core scouting match runtime for the app model layer.
 *
 * This module defines timing constants and the {@link App} class, which coordinates
 * match state, rendering, checks, comments, user input actions, serialization, and
 * submission. It also exposes helpers to seek match time, run/pause/stop the loop,
 * register custom processors, and capture normalized click points on the field.
 *
 * @example
 * const app = new App({
 *   year: 2026,
 *   eventKey: '2026miket',
 *   match: 12,
 *   compLevel: 'qm',
 *   team: 2337,
 *   alliance: 'red',
 *   yearInfo
 * });
 *
 * app.init(document.getElementById('field')!);
 * const stop = app.start();
 * // ...later
 * stop();
 */

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
import { ReviewFlag } from './flag';
import { Settings } from './settings';

/**
 * Number of discrete ticks processed per second.
 *
 * @type {number}
 * @example
 * const ticksPerSecond = TICKS_PER_SECOND; // 4
 */
export const TICKS_PER_SECOND = 4;
/**
 * Match section ranges in whole seconds, inclusive.
 *
 * @type {{ auto: [number, number]; teleop: [number, number]; endgame: [number, number]; end: [number, number] }}
 * @example
 * const [autoStart, autoEnd] = SECTIONS.auto; // 0, 15
 */
// export const SECTIONS = {
// 	auto: [0, 15],
// 	teleop: [16, 135],
// 	endgame: [136, 150],
// 	end: [151, 160]
// };
/**
 * Named match sections used throughout app timing and UI.
 *
 * @typedef {'auto' | 'teleop' | 'endgame' | 'end'} Section
 * @example
 * const section = /** @type {Section} *\/ ('teleop');
 */
// export type Section = 'auto' | 'teleop' | 'endgame' | 'end';
/**
 * Duration of a single tick in milliseconds.
 *
 * @type {number}
 * @example
 * const msPerTick = TICK_DURATION; // 250
 */
export const TICK_DURATION = 1000 / TICKS_PER_SECOND;

/**
 * Orchestrates scouting runtime behavior for a single team/match context.
 *
 * @example
 * const app = new App({
 *   year: 2026,
 *   eventKey: '2026miket',
 *   match: 12,
 *   compLevel: 'qm',
 *   team: 2337,
 *   alliance: 'blue',
 *   yearInfo
 * });
 * app.init(containerElement);
 */
export class App {
	/**
	 * Internal event emitter used for runtime app events.
	 *
	 * @private
	 * @type {EventEmitter<{
	 * 	tick: Tick;
	 * 	section: Section;
	 * 	action: { action: string; point: Point2D; alliance: 'red' | 'blue' | null };
	 * 	second: number;
	 * 	stopped: undefined;
	 * 	end: undefined;
	 * 	stop: undefined;
	 * 	pause: undefined;
	 * 	resume: undefined;
	 * 	error: Error;
	 * 	reset: undefined;
	 * }>}
	 */
	private readonly emitter = new EventEmitter<{
		tick: Tick;
		section: keyof App['config']['yearInfo']['timer'];
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

	/**
	 * Subscribes an event handler.
	 *
	 * @type {EventEmitter<{
	 * 	tick: Tick;
	 * 	section: Section;
	 * 	action: { action: string; point: Point2D; alliance: 'red' | 'blue' | null };
	 * 	second: number;
	 * 	stopped: undefined;
	 * 	end: undefined;
	 * 	stop: undefined;
	 * 	pause: undefined;
	 * 	resume: undefined;
	 * 	error: Error;
	 * 	reset: undefined;
	 * }>['on']}
	 * @example
	 * app.on('tick', (tick) => console.log(tick.time));
	 */
	public readonly on = this.emitter.on.bind(this.emitter);
	/**
	 * Unsubscribes an event handler.
	 *
	 * @type {EventEmitter<{
	 * 	tick: Tick;
	 * 	section: Section;
	 * 	action: { action: string; point: Point2D; alliance: 'red' | 'blue' | null };
	 * 	second: number;
	 * 	stopped: undefined;
	 * 	end: undefined;
	 * 	stop: undefined;
	 * 	pause: undefined;
	 * 	resume: undefined;
	 * 	error: Error;
	 * 	reset: undefined;
	 * }>['off']}
	 * @example
	 * app.off('tick', handler);
	 */
	public readonly off = this.emitter.off.bind(this.emitter);
	/**
	 * Subscribes an event handler for a single invocation.
	 *
	 * @type {EventEmitter<{
	 * 	tick: Tick;
	 * 	section: Section;
	 * 	action: { action: string; point: Point2D; alliance: 'red' | 'blue' | null };
	 * 	second: number;
	 * 	stopped: undefined;
	 * 	end: undefined;
	 * 	stop: undefined;
	 * 	pause: undefined;
	 * 	resume: undefined;
	 * 	error: Error;
	 * 	reset: undefined;
	 * }>['once']}
	 * @example
	 * app.once('end', () => console.log('Match playback ended'));
	 */
	public readonly once = this.emitter.once.bind(this.emitter);
	/**
	 * Emits an app event.
	 *
	 * @type {EventEmitter<{
	 * 	tick: Tick;
	 * 	section: Section;
	 * 	action: { action: string; point: Point2D; alliance: 'red' | 'blue' | null };
	 * 	second: number;
	 * 	stopped: undefined;
	 * 	end: undefined;
	 * 	stop: undefined;
	 * 	pause: undefined;
	 * 	resume: undefined;
	 * 	error: Error;
	 * 	reset: undefined;
	 * }>['emit']}
	 * @example
	 * app.emit('pause', undefined);
	 */
	public readonly emit = this.emitter.emit.bind(this.emitter);

	/**
	 * Match metadata and submission context for the active scout session.
	 *
	 * @public
	 * @readonly
	 * @type {MatchData}
	 */
	public readonly matchData: MatchData;
	/**
	 * Mutable runtime state for tick index, location, and trace data.
	 *
	 * @public
	 * @readonly
	 * @type {AppState}
	 */
	public readonly state: AppState;
	/**
	 * View/controller abstraction for rendering and timing UI updates.
	 *
	 * @public
	 * @readonly
	 * @type {AppView}
	 */
	public readonly view: AppView;
	/**
	 * Match checks manager (booleans/sliders and related serialization).
	 *
	 * @public
	 * @readonly
	 * @type {Checks}
	 */
	public readonly checks: Checks;
	/**
	 * Freeform comment manager used in scout submissions.
	 *
	 * @public
	 * @readonly
	 * @type {Comments}
	 */
	public readonly comments: Comments;

	/**
	 * Year-specific settings for this app
	 *
	 * @public
	 * @readonly
	 * @type {Settings}
	 */
	public readonly settings: Settings;
	// public readonly scoreCorrection: ScoreCorrection;
	/**
	 * Score contribution estimator for the current trace.
	 *
	 * @public
	 * @readonly
	 * @type {ScoreContribution}
	 */
	public readonly contribution: ScoreContribution;

	/**
	 * Flag this match submission for future review
	 *
	 * @public
	 * @readonly
	 * @type {ReviewFlag}
	 */
	public readonly reviewFlag: ReviewFlag;
	/**
	 * Registered interactive game objects and their render constraints.
	 *
	 * @public
	 * @readonly
	 * @type {{
	 * 		point: Point2D;
	 * 		object: AppObject;
	 * 		element: HTMLElement;
	 * 		alliance: 'red' | 'blue' | null;
	 * 		viewCondition?: (tick: Tick) => boolean;
	 * 		staticX: boolean;
	 * 		staticY: boolean;
	 * 	}[]}
	 */
	public readonly gameObjects: {
		point: Point2D;
		object: AppObject;
		element: HTMLElement;
		alliance: 'red' | 'blue' | null;
		viewCondition?: (tick: Tick) => boolean;
		staticX: boolean;
		staticY: boolean;
	}[] = [];
	/**
	 * Reactive running-state store for playback status.
	 *
	 * @type {import('svelte/store').Writable<boolean>}
	 * @example
	 * app.running.set(true);
	 */
	public readonly running = writable(false);

	/**
	 * Creates an app instance for a specific event/match/team context.
	 *
	 * @param {Readonly<{
	 * 	year: number;
	 * 	eventKey: string;
	 * 	match: number;
	 * 	compLevel: CompLevel;
	 * 	team: number;
	 * 	alliance: 'red' | 'blue' | null;
	 * 	yearInfo: YearInfo;
	 * }>} config - Immutable app configuration.
	 * @example
	 * const app = new App({
	 *   year: 2026,
	 *   eventKey: '2026miket',
	 *   match: 7,
	 *   compLevel: 'qm',
	 *   team: 2337,
	 *   alliance: 'red',
	 *   yearInfo
	 * });
	 */
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
		this.reviewFlag = new ReviewFlag(this);
		this.settings = new Settings(this);
		// this.scoreCorrection = new ScoreCorrection(this);
	}

	get totalTicks() {
		return Math.max(
			...Object.values(this.config.yearInfo.timer).map(([, end]) => end * TICKS_PER_SECOND)
		);
	}

	/**
	 * Serializes the current scout session into the compressed match schema payload.
	 *
	 * @returns {ReturnType<typeof attemptAsync<CompressedMatchSchemaType>>} Result wrapper containing serialized payload.
	 * @example
	 * const result = await app.serialize();
	 * if (result.isOk()) console.log(result.value.match);
	 */
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
				sliders,
				flagForReview: this.reviewFlag.serialize()
				// scoreCorrection: this.scoreCorrection.serialize(),
			};
		});
	}

	/**
	 * Initializes app subsystems and binds the view to a target element.
	 *
	 * @param {HTMLElement} target - Root element where the field/timer UI is mounted.
	 * @returns {void}
	 * @example
	 * app.init(document.getElementById('field')!);
	 */
	init(target: HTMLElement) {
		this.state.init();
		this.comments.init();
		this.view.init(target);
		this.matchData.init();
	}

	/**
	 * Resets app state, checks, comments, and view state for a fresh session.
	 *
	 * @returns {void}
	 * @example
	 * app.reset();
	 */
	reset() {
		this.state.init();
		this.comments.reset();
		this.checks.reset();
		this.view.reset();
		this.reviewFlag.reset();
		this.emit('reset', undefined);
	}

	/**
	 * Starts the main tick loop and emits section/tick/second lifecycle events.
	 *
	 * @param {(tick: Tick) => void} [cb] - Optional callback executed each tick.
	 * @returns {() => void} Cleanup function that fully stops this loop instance.
	 * @example
	 * const stop = app.start((tick) => {
	 *   console.log('Tick index:', app.state.currentIndex, tick.point);
	 * });
	 * stop();
	 */
	start(cb?: (tick: Tick) => void) {
		let prevSection: keyof App['config']['yearInfo']['timer'] | null = null;
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

	/**
	 * Starts continuous view animation/render updates.
	 *
	 * @returns {ReturnType<AppView['start']>} Stop function (or controller) returned by the view layer.
	 * @example
	 * const stopAnimation = app.animate();
	 */
	animate() {
		return this.view.start();
	}

	/**
	 * Stops playback and resets displayed timer values.
	 *
	 * @returns {void}
	 * @example
	 * app.stop();
	 */
	stop() {
		this.state.currentIndex = -1;
		this.view.timer.set({
			section: null,
			second: -1,
			index: -1
		});
		this.emit('stop', undefined);
	}

	/**
	 * Pauses playback by emitting the internal pause event.
	 *
	 * @returns {void}
	 * @example
	 * app.pause();
	 */
	pause() {
		this.emit('pause', undefined);
	}

	/**
	 * Resumes playback if paused, or restarts from zero if the app is fully stopped.
	 *
	 * @returns {ReturnType<App['emit']> | ReturnType<App['start']>} Event emission result or newly created stop function.
	 * @example
	 * app.resume();
	 */
	resume() {
		if (this.state.currentIndex !== -1) return this.emit('resume', undefined);
		return this.start();
	}

	/**
	 * Seeks playback to the beginning of the given match section.
	 *
	 * @param {keyof App['config']['yearInfo']['timer']} section - Section to seek to.
	 * @returns {void}
	 * @example
	 * app.goto('endgame');
	 */
	goto(section: keyof App['config']['yearInfo']['timer']) {
		const [start] = this.config.yearInfo.timer[section];
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

	/**
	 * Seeks playback to a specific tick index, clamped to valid range.
	 *
	 * @param {number} index - Desired tick index in the inclusive range [0, TOTAL_TICKS].
	 * @returns {void}
	 * @example
	 * app.gotoTickIndex(120);
	 */
	gotoTickIndex(index: number) {
		if (index < 0) index = 0;
		if (index > this.totalTicks) index = this.totalTicks;
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

	/**
	 * Registers an interactive app object and wires button interactions.
	 *
	 * @template T
	 * @param {{
	 * 	point: Point2D;
	 * 	object: AppObject<T>;
	 * 	button: HTMLElement;
	 * 	convert?: (state: T) => string;
	 * 	alliance: 'red' | 'blue' | null;
	 * 	viewCondition?: (tick: Tick) => boolean;
	 * 	staticX: boolean;
	 * 	staticY: boolean;
	 * }} config - Object registration configuration.
	 * @returns {void}
	 * @example
	 * app.addAppObject({
	 *   point: [0.25, 0.4],
	 *   object: myAppObject,
	 *   button: myButton,
	 *   alliance: 'red',
	 *   staticX: false,
	 *   staticY: false
	 * });
	 */
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
		const obj = {
			point: config.point,
			object: config.object as AppObject<unknown>,
			element: config.button,
			alliance: config.alliance,
			viewCondition: config.viewCondition,
			staticX: config.staticX,
			staticY: config.staticY
		};
		this.gameObjects.push(obj);

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

		return obj;
	}
	/**
	 * Enables an overlay utility for collecting normalized click points.
	 *
	 * Hotkeys while enabled:
	 * - Ctrl+R: reset points
	 * - Ctrl+V: print points
	 * - Ctrl+D: disable overlay
	 * - Ctrl+E: enable overlay
	 *
	 * @param {number} sigFigs - Number of decimal places used when printing points.
	 * @returns {void}
	 * @throws {Error} Thrown if {@link sigFigs} is not an integer.
	 * @example
	 * app.clickPoints(3);
	 */
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

	/**
	 * Submits the current serialized match payload to the backend.
	 *
	 * @returns {ReturnType<typeof attemptAsync<void>>} Result wrapper for submission success/failure.
	 * @example
	 * const result = await app.submit();
	 * if (result.isErr()) console.error(result.error);
	 */
	submit() {
		return attemptAsync(async () => {
			const serialized = (await this.serialize()).unwrap();
			(await AppData.submitMatch(serialized, true)).unwrap();
			// I have a feeling this is not needed. the reset function is called from the svelte file, this just makes it get called twice.
			// this.reset();
		});
	}

	/**
	 * Registered post-processing callbacks executed by {@link runProcessors}.
	 *
	 * @private
	 * @type {Set<Processor>}
	 */
	private readonly processors = new Set<Processor>();

	/**
	 * Registers a processor callback to run against this app instance.
	 *
	 * @param {Processor} processor - Processor function to register.
	 * @returns {void}
	 * @example
	 * app.registerProcessor((ctx) => {
	 *   console.log(ctx.state.section);
	 * });
	 */
	registerProcessor(processor: Processor) {
		this.processors.add(processor);
	}

	/**
	 * Executes all registered processors in insertion order.
	 *
	 * @returns {void}
	 * @example
	 * app.runProcessors();
	 */
	runProcessors() {
		for (const processor of this.processors) {
			processor(this);
		}
	}
}

/**
 * Callback signature for app-level post processors.
 *
 * @param {App} app - Active app instance to inspect/mutate.
 * @returns {void}
 * @example
 * const processor = (app) => {
 *   if (app.state.section === 'auto') {
 *     // custom logic
 *   }
 * };
 */
type Processor = (app: App) => void;
