/**
 * @fileoverview Defines a lightweight action snapshot used by the runtime
 * to associate a trace action, point, and app context.
 */

import type { Point2D } from 'math/point';
import type { Action } from 'tatorscout/trace';
import type { Tick } from './tick';
import type { App } from './app';

/**
 * Immutable action snapshot containing point, action ID, and owning app.
 *
 * @example
 * const state = new ActionState([0.5, 0.3], 'cl1', app);
 * state.tick = app.state.tick ?? null;
 */
export class ActionState {
	/**
	 * Tick currently associated with this action, if known.
	 *
	 * @type {Tick | null}
	 */
	public tick: Tick | null = null;

	/**
	 * Creates an action snapshot.
	 *
	 * @param {Point2D} point - Normalized field position in `[x, y]`.
	 * @param {Action} action - Trace action key.
	 * @param {App} app - App instance that owns this action.
	 * @example
	 * const state = new ActionState([0.2, 0.7], 'dpc', app);
	 */
	constructor(
		public readonly point: Point2D,
		public readonly action: Action,
		public readonly app: App
	) {}
}
