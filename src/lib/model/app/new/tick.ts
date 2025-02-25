import type { Action } from 'tatorscout/trace';
import { App, SECTIONS, TICKS_PER_SECOND, type Section } from './app';
import type { Point2D } from 'math/point';
import { ActionState } from './app-object';

export class Tick {
	public action: Action | 0 = 0;
	public point: Point2D | null = null;

	private _data: ActionState | null = null;

	constructor(
		public readonly time: number,
		public readonly index: number,
		public readonly app: App
	) {}

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
		this._data = null;
	}

	set(state: ActionState) {
		if (this._data instanceof ActionState) {
			this.next()?.set(state);
		}

		this._data = state;
		state.tick = this;
	}

	next(): Tick | undefined {
		return this.app.state.ticks[this.app.state.currentIndex + 1];
	}
}
