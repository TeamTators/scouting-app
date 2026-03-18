/**
 * @fileoverview Runtime state container for current location, index, and ticks.
 */

import type { Point2D } from 'math/point';
import { App, TICKS_PER_SECOND } from './app';
import { Tick, Ticks } from './tick';
import { type TraceArray } from 'tatorscout/trace';
import { WritableBase } from '$lib/services/writables';

/**
 * Live app state including pointer location and current timeline index.
 *
 * @extends {WritableBase<{ currentLocation: Point2D | null; currentIndex: number }>}
 */
export class AppState extends WritableBase<{
	currentLocation: Point2D | null;
	currentIndex: number;
}> {
	/**
	 * Tick collection for the full match timeline.
	 *
	 * @type {Ticks}
	 */
	public ticks: Ticks;

	/**
	 * Creates runtime state.
	 *
	 * @param {App} app - Owning app instance.
	 */
	constructor(public readonly app: App) {
		super({
			currentLocation: null,
			currentIndex: -1
		});
		this.ticks = new Ticks(app);
	}

	/**
	 * Current normalized pointer location.
	 *
	 * @type {Point2D | null}
	 */
	get currentLocation() {
		return this.data.currentLocation;
	}

	/**
	 * Sets current pointer location.
	 *
	 * @type {Point2D | null}
	 */
	set currentLocation(value: Point2D | null) {
		this.update((state) => ({
			...state,
			currentLocation: value
		}));
	}

	/**
	 * Current tick index.
	 *
	 * @type {number}
	 */
	get currentIndex() {
		return this.data.currentIndex;
	}

	/**
	 * Sets current tick index.
	 *
	 * @type {number}
	 */
	set currentIndex(value: number) {
		this.update((state) => ({
			...state,
			currentIndex: value
		}));
	}

	/**
	 * Tick at current index.
	 *
	 * @type {Tick | undefined}
	 */
	get tick(): Tick | undefined {
		return this.ticks.data[this.currentIndex];
	}

	/**
	 * Current section inferred from current tick.
	 *
	 * @type {Section | null}
	 */
	get section() {
		const tick = this.tick;
		if (!tick) return null;
		for (const [section, range] of Object.entries(this.app.config.yearInfo.timer)) {
			const [start, end] = range as number[];
			if (tick.second >= start && tick.second <= end) {
				return section as keyof App['config']['yearInfo']['timer'];
			}
		}
		return null;
	}

	/**
	 * Last known point in the timeline up to the current index.
	 *
	 * @type {Point2D}
	 */
	get lastLocation() {
		for (let i = this.currentIndex; i >= 0; i--) {
			const tick = this.ticks.data[i];
			if (tick.point) {
				return tick.point;
			}
		}
		return [-1, -1];
	}

	/**
	 * Initializes the timeline with empty ticks and resets state.
	 *
	 * @returns {void}
	 */
	init() {
		this.currentIndex = -1;
		this.currentLocation = null;
		this.ticks.set(
			Array.from(
				{
					length: this.app.totalTicks
				},
				(_, i) => {
					const t = new Tick(i / TICKS_PER_SECOND, i, this.app);
					this.ticks.pipe(t);
					return t;
				}
			)
		);
	}

	/**
	 * Serializes trace-like tick rows with integerized coordinates.
	 *
	 * @returns {Array<[number, number, number, import('tatorscout/trace').Action | 0]>} Serialized rows.
	 */
	serialize() {
		const toFixed = (num: number) => Math.round(num * 1000);
		return this.ticks.data
			.filter((t) => !!t.point)
			.map((t) => [t.index, toFixed(t.point?.[0] || 0), toFixed(t.point?.[1] || 0), t.action]);
	}

	/**
	 * Builds a trace array from point-bearing ticks.
	 *
	 * @returns {TraceArray} Trace rows used by `Trace.parse`.
	 */
	traceArray(): TraceArray {
		return this.ticks.data
			.filter((t) => !!t.point)
			.map((t) => [t.index, t.point?.[0] || 0, t.point?.[1] || 0, t.action]);
	}

	/**
	 * Removes all action states from ticks and recomputes contributions.
	 *
	 * @returns {void}
	 */
	removeActionStates() {
		for (const tick of this.ticks.data) {
			tick.clear();
		}

		this.app.contribution.render();
	}
}
