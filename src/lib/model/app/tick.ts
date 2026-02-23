/**
 * @fileoverview Tick-level state and helpers for match timeline playback.
 */

import type { Action } from 'tatorscout/trace';
import { App, SECTIONS, TICKS_PER_SECOND, type Section } from './app';
import type { Point2D } from 'math/point';
import { ActionState } from './app-object';
import { WritableArray, WritableBase } from '$lib/services/writables';

/**
 * A single timeline tick containing optional point/action state.
 *
 * @extends {WritableBase<ActionState | null>}
 */
export class Tick extends WritableBase<ActionState | null> {
	/**
	 * Action key at this tick (`0` means no action).
	 *
	 * @type {Action | 0}
	 */
	public action: Action | 0 = 0;
	/**
	 * Normalized point recorded at this tick.
	 *
	 * @type {Point2D | null}
	 */
	public point: Point2D | null = null;

	/**
	 * Creates a tick.
	 *
	 * @param {number} time - Tick time in seconds.
	 * @param {number} index - Tick index.
	 * @param {App} app - Owning app instance.
	 */
	constructor(
		public readonly time: number,
		public readonly index: number,
		public readonly app: App
	) {
		super(null);
	}

	/**
	 * Whole second represented by this tick.
	 *
	 * @type {number}
	 */
	public get second() {
		return Math.round(this.index / TICKS_PER_SECOND);
	}

	/**
	 * Match section for this tick.
	 *
	 * @type {Section | null}
	 */
	public get section() {
		for (const [section, range] of Object.entries(SECTIONS)) {
			const [start, end] = range as number[];
			if (this.second >= start && this.second <= end) {
				return section as Section;
			}
		}

		return null;
	}

	/**
	 * Clears point, action, and attached action state.
	 *
	 * @returns {void}
	 */
	clear() {
		this.action = 0;
		this.point = null;
		this.data = null;
	}

	/**
	 * Sets an action state on this tick, forwarding to the next tick if occupied.
	 *
	 * @param {ActionState} state - Action state to attach.
	 * @param {'red' | 'blue' | null} [alliance=null] - Alliance context for emitted action.
	 * @returns {void}
	 */
	setActionState<T>(state: ActionState<T>, alliance: 'red' | 'blue' | null = null) {
		if (this.data instanceof ActionState) {
			this.next()?.setActionState(state);
			return;
		}

		this.data = state as ActionState;
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

	/**
	 * Returns the next tick.
	 *
	 * @returns {Tick | undefined} Next tick or `undefined`.
	 */
	next(): Tick | undefined {
		return this.app.state.ticks.data[this.index + 1];
	}

	/**
	 * Returns the previous tick.
	 *
	 * @returns {Tick | undefined} Previous tick or `undefined`.
	 */
	prev(): Tick | undefined {
		return this.app.state.ticks.data[this.index - 1];
	}
}

/**
 * Typed writable array for ticks.
 *
 * @extends {WritableArray<Tick>}
 */
export class Ticks extends WritableArray<Tick> {
	/**
	 * Creates a tick collection.
	 *
	 * @param {App} app - Owning app instance.
	 */
	constructor(public readonly app: App) {
		super([]);
	}
}
