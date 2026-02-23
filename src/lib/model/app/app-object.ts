/**
 * @fileoverview Stateful action objects used to generate traceable tick events.
 */

import { EventEmitter } from 'ts-utils/event-emitter';
import { type Point2D } from 'math/point';
import { Tick } from './tick';

/**
 * Base stateful action object with history and lifecycle events.
 *
 * @template T
 * @example
 * const counter = new AppObject<number>({
 *   name: 'Cycles',
 *   description: 'Cycle count',
 *   abbr: 'cyc',
 *   default: 0,
 *   update: (state = 0) => state + 1
 * });
 * counter.update([0.4, 0.2]);
 */
export class AppObject<T = unknown> {
	/** Internal lifecycle emitter. */
	private readonly em = new EventEmitter<{
		change: ActionState<T | undefined>;
		new: ActionState<T | undefined>;
		undo: ActionState<T | undefined>;
	}>();

	/** Subscribe to object lifecycle events. */
	public readonly on = this.em.on.bind(this.em);
	/** Unsubscribe from object lifecycle events. */
	public readonly off = this.em.off.bind(this.em);
	/** Subscribe once to object lifecycle events. */
	public readonly once = this.em.once.bind(this.em);
	/** Emit object lifecycle events. */
	public readonly emit = this.em.emit.bind(this.em);

	/** Current object state. */
	public state?: T;

	/** Ordered history of emitted action states. */
	public readonly stateHistory: ActionState<T>[] = [];

	/**
	 * Creates an app action object.
	 *
	 * @param {{
	 * 	update?: (state?: T) => T;
	 * 	name: string;
	 * 	description: string;
	 * 	abbr: string;
	 * 	default?: T;
	 * }} config - Object definition and update behavior.
	 */
	constructor(
		public readonly config: {
			update?: (state?: T) => T;
			name: string;
			description: string;
			abbr: string;
			default?: T;
		}
	) {
		this.state = config.default;
	}

	/**
	 * Applies object update function, stores history, and emits events.
	 *
	 * @param {Point2D} [point] - Optional point associated with this state change.
	 * @returns {void}
	 */
	update(point?: Point2D) {
		if (this.config.update) {
			this.state = this.config.update(this.state);
			const actionState = new ActionState({
				object: this,
				state: this.state,
				point
			});
			this.stateHistory.push(actionState);

			this.emit('change', actionState as ActionState<T | undefined>);
			this.emit('new', actionState as ActionState<T | undefined>);
		}
	}

	/**
	 * Reverts to previous state in history when possible.
	 *
	 * @returns {void}
	 */
	public undo() {
		if (this.stateHistory.length > 1) {
			this.stateHistory.pop();
			const actionState = this.stateHistory[this.stateHistory.length - 1];
			this.emit('change', actionState as ActionState<T | undefined>);
			this.emit('undo', actionState as ActionState<T | undefined>);
			this.state = actionState.state;
		} else {
			console.warn(`Cannot undo atcion ${this.config.name}`);
		}
	}

	/**
	 * Returns state as string.
	 *
	 * @returns {string} Stringified state.
	 */
	toString() {
		return String(this.state);
	}
}

/**
 * Snapshot of a single app-object transition.
 *
 * @template T
 */
export class ActionState<T = unknown> {
	/** ISO timestamp when state snapshot was created. */
	public readonly created = new Date().toISOString();
	/** Tick associated after placement in timeline. */
	tick: Tick | undefined;

	/**
	 * Creates an action-state snapshot.
	 *
	 * @param {{
	 * 	object: AppObject<T>;
	 * 	state: T;
	 * 	point?: Point2D;
	 * }} config - Snapshot payload.
	 */
	constructor(
		public readonly config: {
			object: AppObject<T>;
			state: T;
			point?: Point2D;
		}
	) {}

	/** Snapshot state value. */
	get state() {
		return this.config.state;
	}
}

/**
 * Boolean app object that toggles on each update.
 *
 * @extends {AppObject<boolean>}
 */
export class Toggle extends AppObject<boolean> {
	/**
	 * Creates a toggle object.
	 *
	 * @param {{ name: string; description: string; abbr: string; default?: boolean }} config - Toggle config.
	 */
	constructor(config: { name: string; description: string; abbr: string; default?: boolean }) {
		super({
			...config,
			update: (state) => !state
		});
	}

	/**
	 * Human-readable toggle state.
	 *
	 * @returns {'on' | 'off'} Current state label.
	 */
	toString() {
		return this.state ? 'on' : 'off';
	}
}

/**
 * Numeric app object incremented on each update.
 *
 * @extends {AppObject<number>}
 */
export class Iterator extends AppObject<number> {
	/**
	 * Creates an iterator object.
	 *
	 * @param {{
	 * 	name: string;
	 * 	description: string;
	 * 	abbr: string;
	 * 	default?: number;
	 * 	min?: number;
	 * 	max?: number;
	 * }} config - Iterator config.
	 */
	constructor(config: {
		name: string;
		description: string;
		abbr: string;
		default?: number;
		min?: number;
		max?: number;
	}) {
		super({
			...config,
			update: (state) => {
				return state === undefined ? 0 : state + 1;
			}
		});
	}

	/**
	 * String representation of iterator value.
	 *
	 * @returns {string} Stringified value.
	 */
	toString() {
		return String(this.state);
	}
}

// Move through a list of states, go back to the beginning when you reach the end
/**
 * Cycles through a finite list of states.
 *
 * @template T
 * @extends {AppObject<T>}
 */
export class StateList<T> extends AppObject<T> {
	/**
	 * Creates a cyclic state-list object.
	 *
	 * @param {{
	 * 	name: string;
	 * 	description: string;
	 * 	abbr: string;
	 * 	states: T[];
	 * 	default?: T;
	 * }} config - State-list config.
	 */
	constructor(config: {
		name: string;
		description: string;
		abbr: string;
		states: T[];
		default?: T;
	}) {
		super({
			...config,
			update: (state) => {
				if (!state) return config.states[0];
				const index = config.states.indexOf(state);
				return config.states[(index + 1) % config.states.length];
			}
		});
	}
}

// Move through a list of states, but go backwards when you reach the end
/**
 * Cycles through states in a ping-pong (forward/backward) pattern.
 *
 * @template T
 * @extends {AppObject<T>}
 */
export class PingPong<T> extends AppObject<T> {
	/** Direction of travel through `states` (`1` or `-1`). */
	private _direction = 1;

	/**
	 * Creates a ping-pong state object.
	 *
	 * @param {{
	 * 	name: string;
	 * 	description: string;
	 * 	abbr: string;
	 * 	states: T[];
	 * 	default?: T;
	 * }} config - Ping-pong config.
	 */
	constructor(config: {
		name: string;
		description: string;
		abbr: string;
		states: T[];
		default?: T;
	}) {
		super({
			...config,
			update: (state) => {
				if (!state) return config.states[0];
				const index = config.states.indexOf(state);
				const next = index + this._direction;
				if (next < 0 || next >= config.states.length) {
					this._direction *= -1;
				}
				return config.states[index + this._direction];
			}
		});
	}
}
