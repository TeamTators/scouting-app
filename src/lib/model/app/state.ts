import type { Point2D } from 'math/point';
import { App, TOTAL_TICKS, TICKS_PER_SECOND, SECTIONS, type Section } from './app';
import { Tick, Ticks } from './tick';
import { type TraceArray } from 'tatorscout/trace';
import { WritableBase } from '$lib/services/writables';

export class AppState extends WritableBase<{
	currentLocation: Point2D | null;
	currentIndex: number;
}> {
	public ticks: Ticks;

	constructor(public readonly app: App) {
		super({
			currentLocation: null,
			currentIndex: -1
		});
		this.ticks = new Ticks(app);
	}

	get currentLocation() {
		return this.data.currentLocation;
	}

	set currentLocation(value: Point2D | null) {
		this.update((state) => ({
			...state,
			currentLocation: value
		}));
	}

	get currentIndex() {
		return this.data.currentIndex;
	}

	set currentIndex(value: number) {
		this.update((state) => ({
			...state,
			currentIndex: value
		}));
	}

	get tick(): Tick | undefined {
		return this.ticks.data[this.currentIndex];
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
			const tick = this.ticks.data[i];
			if (tick.point) {
				return tick.point;
			}
		}
		return [-1, -1];
	}

	init() {
		this.currentIndex = -1;
		this.currentLocation = null;
		this.ticks.set(
			Array.from(
				{
					length: TOTAL_TICKS
				},
				(_, i) => {
					const t = new Tick(i / TICKS_PER_SECOND, i, this.app);
					this.ticks.pipe(t);
					return t;
				}
			)
		);
	}

	serialize() {
		const toFixed = (num: number) => Math.round(num * 1000);
		return this.ticks.data
			.filter((t) => !!t.point)
			.map((t) => [t.index, toFixed(t.point?.[0] || 0), toFixed(t.point?.[1] || 0), t.action]);
	}

	traceArray(): TraceArray {
		return this.ticks.data
			.filter((t) => !!t.point)
			.map((t) => [t.index, t.point?.[0] || 0, t.point?.[1] || 0, t.action]);
	}

	removeActionStates() {
		for (const tick of this.ticks.data) {
			tick.clear();
		}

		this.app.contribution.render();
	}
}
