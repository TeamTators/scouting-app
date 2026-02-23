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
export type ScoreContributionData = {
	auto: Record<string, number>;
	teleop: Record<string, number>;
	endgame: Record<string, number>;
};

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
			auto: {},
			teleop: {},
			endgame: {}
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
		const newData: ScoreContributionData = {
			auto: {},
			teleop: {},
			endgame: {}
		};

		for (const tick of this.app.state.ticks.data) {
			const section = tick.section;
			if (tick.action && section) {
				const action = tick.action;
				switch (section) {
					case 'auto':
						newData.auto[action] = (newData.auto[action] || 0) + 1;
						break;
					case 'teleop':
						newData.teleop[action] = (newData.teleop[action] || 0) + 1;
						break;
					case 'endgame':
						newData.endgame[action] = (newData.endgame[action] || 0) + 1;
						break;
				}
			}
		}

		this.set(newData);
	}
}
