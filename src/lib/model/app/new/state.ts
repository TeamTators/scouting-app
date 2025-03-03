import type { Point2D } from 'math/point';
import { App, TOTAL_TICKS, TICKS_PER_SECOND, SECTIONS, type Section } from './app';
import { Tick } from './tick';
import type { TraceArray } from 'tatorscout/trace';

export class AppState {
	public currentLocation: Point2D | null = null;

	public currentIndex = -1;
	public ticks: Tick[] = [];

	constructor(public readonly app: App) {}

	get tick(): Tick | undefined {
		return this.ticks[this.currentIndex];
	}

	get section() {
		const tick = this.tick;
		if (!tick) return null;
		for (const [section, range] of Object.entries(SECTIONS)) {
			const [start, end] = range;
			if (tick.second >= start && tick.second <= end) {
				return section as Section;
			}
		}
		return null;
	}

	get lastLocation() {
		for (let i = this.currentIndex; i >= 0; i--) {
			const tick = this.ticks[i];
			if (tick.point) {
				return tick.point;
			}
		}
		return [-1, -1];
	}

	init() {
		this.ticks = Array.from(
			{
				length: TOTAL_TICKS
			},
			(_, i) => new Tick(i / TICKS_PER_SECOND, i, this.app)
		);

		return () => {};
	}

	serialize(): TraceArray {
		const ticks = this.ticks.slice(1);
		return ticks
			.filter((t) => !!t.point)
			.map((t) => [t.index, t.point?.[0] || 0, t.point?.[1] || 0, t.action]);
	}
}
