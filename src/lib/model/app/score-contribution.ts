/**
 * @fileoverview Computes per-section action contribution counts from trace data.
 */

import { WritableBase } from '$lib/services/writables';
import type { App } from './app';

/**
 * Aggregated action counts by match section.
 *
 * @example
 * const data: ScoreContributionData = {
 *   auto: { cl1: 2 },
 *   teleop: { cl2: 4 },
 *   endgame: { dpc: 1 }
 * };
 */
export type ScoreContributionData = Record<string, Record<string, number>>;

/**
 * Writable score contribution model derived from current app ticks.
 *
 * @extends {WritableBase<ScoreContributionData>}
 * @example
 * const contribution = new ScoreContribution(app);
 * contribution.render();
 */
export class ScoreContribution extends WritableBase<ScoreContributionData> {
	/**
	 * Creates the contribution model.
	 *
	 * @param {App} app - App instance providing tick/action data.
	 */
	constructor(public readonly app: App) {
		super({
		});
	}

	/**
	 * Recomputes section totals from all tick action states.
	 *
	 * @returns {void}
	 * @example
	 * app.contribution.render();
	 */
	render() {
		const newData: ScoreContributionData = Object.fromEntries(Object.entries(this.app.config.yearInfo.timer).map(([section, actions]) => [section, Object.fromEntries(Object.keys(actions).map(action => [action, 0]))]));

		for (const tick of this.app.state.ticks.data) {
			const section = tick.section;
			if (tick.action && section) {
				const action = tick.action;
				const section = tick.section;
				if (newData[section] && newData[section][action] !== undefined) {
					newData[section][action]++;
				} else {
					console.warn(`Unexpected action "${action}" in section "${section}" at tick ${tick.index}`);
				}
			}
		}

		this.set(newData);
	}
}
