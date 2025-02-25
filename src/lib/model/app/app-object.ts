/**
 * @fileoverview AppObject class
 * @description The point of this class is to provide a way to change the state of an object and keep track of the history of those changes. This is useful for undo/redo functionality, and for keeping track of the state of the robot over time.
 */

import { EventEmitter } from 'ts-utils/event-emitter';
import { type Point2D } from 'math/point';
import { Tick } from './tick';

/**
 * State of an action at a given point in time
 * @date 1/9/2024 - 3:04:36 AM
 *
 * @export
 * @class ActionState
 * @typedef {ActionState}
 * @template [T=unknown]
 */
export class ActionState<T = unknown, actions = string> {
	/**
	 * When the action state was created
	 * @date 1/9/2024 - 3:04:36 AM
	 *
	 * @public
	 * @readonly
	 * @type {Date}
	 */
	public readonly created: Date = new Date();
	/**
	 * The tick that contains this action state
	 * @date 1/9/2024 - 3:04:36 AM
	 *
	 * @private
	 * @type {(Tick | null)}
	 */
	private $tick: Tick<actions> | null = null;
	/**
	 * Creates an instance of ActionState.
	 * @date 1/9/2024 - 3:04:36 AM
	 *
	 * @constructor
	 * @param {AppObject<T>} action
	 * @param {T} state
	 * @param {?Point2D} [point]
	 */
	constructor(
		public readonly action: AppObject<T>,
		public state: T,
		public readonly point?: Point2D
	) {}

	/**
	 * Set the tick that contains this action state
	 * @date 1/9/2024 - 3:04:36 AM
	 *
	 * @type {*}
	 */
	set tick(tick: Tick | null) {
		if (!!tick && this.$tick) {
			throw new Error(`Tick already set for action ${this.action.name}`);
		}
		this.$tick = tick;
	}

	/**
	 * Returns the tick that contains this action state
	 * @date 1/9/2024 - 3:04:36 AM
	 *
	 * @type {(Tick | null)}
	 */
	get tick(): Tick | null {
		return this.$tick ?? null;
	}
}

type Events<O> = {
	change: O;
};

/**
 * Object that can be changed
 * @date 1/9/2024 - 3:04:36 AM
 *
 * @export
 * @class AppObject
 * @typedef {AppObject}
 * @template [T=unknown]
 */
export class AppObject<T = unknown, actions = string> {
	public readonly em = new EventEmitter<Events<this>>();

	public on<K extends keyof Events<this>>(event: K, listener: (arg: Events<this>[K]) => void) {
		this.em.on(event, listener);
	}

	public off<K extends keyof Events<this>>(event: K, listener: (arg: Events<this>[K]) => void) {
		this.em.off(event, listener);
	}

	public emit<K extends keyof Events<this>>(event: K, arg: Events<this>[K]) {
		this.em.emit(event, arg);
	}

	/**
	 * Current state of the object
	 * @date 1/9/2024 - 3:04:36 AM
	 *
	 * @public
	 * @type {T}
	 */
	public state?: T;
	/**
	 * History of states of the object
	 * @date 1/9/2024 - 3:04:36 AM
	 *
	 * @public
	 * @readonly
	 * @type {ActionState<T>[]}
	 */
	public readonly stateHistory: ActionState<T>[] = [];

	/**
	 * Function that changes the state of the object given the current state
	 * @date 1/9/2024 - 3:04:36 AM
	 *
	 * @private
	 * @type {?((state: T) => T)}
	 */
	private $toChange?: (state: T | undefined) => T;
	/**
	 * Listeners that are called when the state of the object changes
	 * @date 1/9/2024 - 3:04:36 AM
	 *
	 * @private
	 * @readonly
	 * @type {((state: ActionState<T>) => void)[]}
	 */
	private readonly $listeners: ((state: ActionState<T>, event: 'new' | 'undo') => void)[] = [];

	public readonly abbr: actions | string;

	/**
	 * Creates an instance of AppObject.
	 * @date 1/9/2024 - 3:04:36 AM
	 *
	 * @constructor
	 * @param {string} name
	 * @param {string} description
	 */
	constructor(
		public readonly name: string,
		public readonly description: string,
		abbr?: actions
	) {
		this.abbr = abbr ? abbr : name.substring(0, 3).toLowerCase();
	}

	/**
	 * Set the function that changes the state of the object given the current state
	 * @date 1/9/2024 - 3:04:36 AM
	 *
	 * @public
	 * @param {(state: T) => T} cb
	 * @returns {T) => void}
	 */
	public toChange(cb: (state: T | undefined) => T) {
		if (this.$toChange) {
			throw new Error(`toChange callback already set for action ${this.name}`);
		}
		this.$toChange = cb;
	}

	/**
	 * Change the state of the object
	 * @date 1/9/2024 - 3:04:36 AM
	 *
	 * @public
	 * @param {?Point2D} [point]
	 * @returns {T}
	 */
	public change(point?: Point2D) {
		if (this.$toChange) {
			this.state = this.$toChange(this.state);
			this.stateHistory.push(new ActionState<T>(this as AppObject<T, string>, this.state, point));

			for (const listener of this.$listeners) {
				listener(this.stateHistory[this.stateHistory.length - 1], 'new');
			}
		} else {
			console.warn('No toChange callback set for action ' + this.name);
		}

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		this.emit('change', this);

		return this.state;
	}

	public get lastState(): ActionState<T, string> | undefined {
		return this.stateHistory[this.stateHistory.length - 1];
	}

	/**
	 * Undo the last change to the state of the object
	 * @date 1/9/2024 - 3:04:36 AM
	 *
	 * @public
	 * @returns {T}
	 */
	public undo() {
		if (this.stateHistory.length > 1) {
			this.stateHistory.pop();
			this.state = this.stateHistory[this.stateHistory.length - 1].state;

			for (const listener of this.$listeners) {
				listener(this.stateHistory[this.stateHistory.length - 1], 'undo');
			}
		} else {
			console.warn(`Cannot undo action ${this.name} because there is only one state`);
		}

		// first state shouldn't have a tick, but we can still remove it just in case
		this.stateHistory[0].tick = null;

		return this.state;
	}

	/**
	 * Listen for changes to the state of the object
	 * @date 1/9/2024 - 3:04:36 AM
	 *
	 * @public
	 * @param {(state: ActionState<T>) => void} cb
	 * @returns {void) => void}
	 */
	public listen(cb: (state: ActionState<T>, event: 'new' | 'undo') => void) {
		this.$listeners.push(cb);
	}

	/**
	 * Convert the current state of the object to a string
	 * @date 1/9/2024 - 3:04:36 AM
	 *
	 * @returns {*}
	 */
	toString() {
		return String(this.state);
	}
}

/**
 * Toggle between two states (true/false)
 * @date 1/9/2024 - 3:04:36 AM
 *
 * @export
 * @class Toggle
 * @typedef {Toggle}
 * @extends {AppObject<boolean>}
 */
export class Toggle extends AppObject<boolean> {
	/**
	 * Creates an instance of Toggle.
	 * @date 1/9/2024 - 3:04:36 AM
	 *
	 * @constructor
	 * @param {string} name
	 * @param {string} description
	 * @param {boolean} [defaultState=false]
	 */
	constructor(name: string, description: string, abbr?: string, defaultState: boolean = false) {
		super(name, description, abbr);
		this.toChange((state) => !state);

		if (defaultState) {
			// creates a new state history with the default state
			this.state = !defaultState;
			this.change();
		}
	}

	/**
	 * Convert the current state of the object to a string (on/off)
	 * @date 1/9/2024 - 3:04:36 AM
	 *
	 * @returns {("on" | "off")}
	 */
	toString() {
		return this.state ? 'on' : 'off';
	}
}

/**
 * Increment a number
 * @date 1/9/2024 - 3:04:36 AM
 *
 * @export
 * @class Iterator
 * @typedef {Iterator}
 * @extends {AppObject<number>}
 */
export class Iterator<actions = string> extends AppObject<number> {
	/**
	 * Creates an instance of Iterator.
	 * @date 1/9/2024 - 3:04:36 AM
	 *
	 * @constructor
	 * @param {string} name
	 * @param {string} description
	 * @param {number} [defaultState=0]
	 */
	constructor(name: string, description: string, abbr?: actions, defaultState = 0) {
		super(name, description, abbr as string);
		this.toChange((state) => {
			if (typeof state === 'undefined') {
				return 0;
			}
			return state + 1;
		});

		if (defaultState !== undefined) {
			// creates a new state history with the default state
			this.state = defaultState - 1;
			this.change();
		}
	}
}

/**
 * Move through a list of states
 * @date 1/9/2024 - 3:04:36 AM
 *
 * @export
 * @class StateMachine
 * @typedef {StateMachine}
 * @template T
 * @extends {AppObject<T>}
 */
export class StateMachine<T> extends AppObject<T> {
	/**
	 * Creates an instance of StateMachine.
	 * @date 1/9/2024 - 3:04:36 AM
	 *
	 * @constructor
	 * @param {string} name
	 * @param {string} description
	 * @param {{}} [states=[] as T[]]
	 */
	constructor(
		name: string,
		description: string,
		abbr?: string,
		public readonly states = [] as T[]
	) {
		super(name, description, abbr);
		this.toChange((state) => {
			if (!state) {
				return this.states[0];
			}
			// move through states in a circular fashion
			const index = this.states.indexOf(state);
			return this.states[(index + 1) % this.states.length];
		});
	}
}

/**
 * Move through a list of states, then reverse direction
 * @date 1/9/2024 - 3:04:36 AM
 *
 * @export
 * @class PingPong
 * @typedef {PingPong}
 * @template T
 * @extends {AppObject<T>}
 */
export class PingPong<T> extends AppObject<T> {
	/**
	 * Direction of the state machine
	 * @date 1/9/2024 - 3:04:36 AM
	 *
	 * @private
	 * @type {number}
	 */
	private $direction = 1; // 1 is forward, -1 is backward

	/**
	 * Creates an instance of PingPong.
	 * @date 1/9/2024 - 3:04:36 AM
	 *
	 * @constructor
	 * @param {string} name
	 * @param {string} description
	 * @param {{}} [states=[] as T[]]
	 */
	constructor(
		name: string,
		description: string,
		abbr?: string,
		public readonly states = [] as T[]
	) {
		super(name, description, abbr);
		this.toChange((state) => {
			if (!state) {
				return this.states[0];
			}
			// move through states, then reverse direction
			const index = this.states.indexOf(state);
			const nextIndex = index + this.$direction;
			if (nextIndex < 0 || nextIndex >= this.states.length) {
				this.$direction *= -1;
			}
			return this.states[index + this.$direction];
		});
	}
}
