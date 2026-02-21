import { EventEmitter } from 'ts-utils/event-emitter';
import { type Point2D } from 'math/point';
import { Tick } from './tick';

export class AppObject<T = unknown> {
	private readonly em = new EventEmitter<{
		change: ActionState<T | undefined>;
		new: ActionState<T | undefined>;
		undo: ActionState<T | undefined>;
	}>();

	public readonly on = this.em.on.bind(this.em);
	public readonly off = this.em.off.bind(this.em);
	public readonly once = this.em.once.bind(this.em);
	public readonly emit = this.em.emit.bind(this.em);

	public state?: T;

	public readonly stateHistory: ActionState<T>[] = [];

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

	toString() {
		return String(this.state);
	}
}

export class ActionState<T = unknown> {
	public readonly created = new Date().toISOString();
	tick: Tick | undefined;

	constructor(
		public readonly config: {
			object: AppObject<T>;
			state: T;
			point?: Point2D;
		}
	) {}

	get state() {
		return this.config.state;
	}
}

export class Toggle extends AppObject<boolean> {
	constructor(config: { name: string; description: string; abbr: string; default?: boolean }) {
		super({
			...config,
			update: (state) => !state
		});
	}

	toString() {
		return this.state ? 'on' : 'off';
	}
}

export class Iterator extends AppObject<number> {
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

	toString() {
		return String(this.state);
	}
}

// Move through a list of states, go back to the beginning when you reach the end
export class StateList<T> extends AppObject<T> {
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
export class PingPong<T> extends AppObject<T> {
	private _direction = 1;

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
