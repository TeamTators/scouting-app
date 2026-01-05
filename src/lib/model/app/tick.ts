import type { Action } from 'tatorscout/trace';
import { App, SECTIONS, TICKS_PER_SECOND, type Section } from './app';
import type { Point2D } from 'math/point';
import { ActionState } from './app-object';
import { WritableArray, WritableBase } from '$lib/writables';

export class Tick extends WritableBase<ActionState | null> {
	public action: Action | 0 = 0;
	public point: Point2D | null = null;

	public data: ActionState | null = null;

	constructor(
		public readonly time: number,
		public readonly index: number,
		public readonly app: App
	) {
		super(null);
	}

	public get second() {
		return Math.round(this.index / TICKS_PER_SECOND);
	}

	public get section() {
		for (const [section, range] of Object.entries(SECTIONS)) {
			const [start, end] = range as number[];
			if (this.second >= start && this.second <= end) {
				return section as Section;
			}
		}

		return null;
	}

	clear() {
		this.action = 0;
		this.point = null;
		this.data = null;
	}

	setActionState(state: ActionState, alliance: 'red' | 'blue' | null = null) {
		if (this.data instanceof ActionState) {
			this.next()?.setActionState(state);
			return;
		}

		this.data = state;
		state.tick = this;
		this.action = state.config.object.config.abbr as Action;
		this.inform();

		this.app.emit('action', {
			action: state.config.object.config.abbr,
			alliance: alliance,
			point: this.app.state.currentLocation || [0, 0]
		});

		this.app.contribution.render();
	}

	next(): Tick | undefined {
		return this.app.state.ticks.data[this.index + 1];
	}

	prev(): Tick | undefined {
		return this.app.state.ticks.data[this.index - 1];
	}
}

export class Ticks extends WritableArray<Tick> {
	constructor(public readonly app: App) {
		super([]);
	}
}
