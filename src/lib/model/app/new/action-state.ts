import type { Point2D } from 'math/point';
import type { Action } from 'tatorscout/trace';
import type { Tick } from './tick';
import type { App } from './app';

export class ActionState {
	public tick: Tick | null = null;

	constructor(
		public readonly point: Point2D,
		public readonly action: Action,
		public readonly app: App
	) {}
}
