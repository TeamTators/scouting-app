/**
 * @fileoverview Manual score correction model for per-section adjustments.
 */

import { WritableBase } from '$lib/services/writables';
import type { App } from './app';

/**
 * Manual correction totals keyed by action and section.
 *
 * @example
 * const correction: ScoreCorrectionData = {
 *   auto: { cl1: 1 },
 *   teleop: {},
 *   endgame: {}
 * };
 */
export type ScoreCorrectionData = {
	auto: Record<string, number>;
	teleop: Record<string, number>;
	endgame: Record<string, number>;
};

/**
 * Writable store for applying score corrections on top of trace-derived values.
 *
 * @extends {WritableBase<ScoreCorrectionData>}
 * @example
 * const correction = new ScoreCorrection(app);
 * correction.reset();
 */
export class ScoreCorrection extends WritableBase<ScoreCorrectionData> {
	/**
	 * Creates the score correction model.
	 *
	 * @param {App} app - App instance that owns this correction set.
	 */
	constructor(public readonly app: App) {
		super({
			auto: {},
			teleop: {},
			endgame: {}
		});
	}

	/**
	 * Initializes correction state.
	 *
	 * @returns {void}
	 */
	init() {}

	/**
	 * Resets correction state.
	 *
	 * @returns {void}
	 */
	reset() {}

	/**
	 * Serializes corrections to plain data.
	 *
	 * @returns {ScoreCorrectionData} Correction payload.
	 * @example
	 * const payload = correction.serialize();
	 */
	serialize() {
		return this.data;
	}
}
