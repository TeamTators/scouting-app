import { WritableBase } from '$lib/writables';
import type { App } from './app';

export type ScoreContributionData = {
	auto: Record<string, number>;
	teleop: Record<string, number>;
	endgame: Record<string, number>;
};

export class ScoreContribution extends WritableBase<ScoreContributionData> {
	constructor(public readonly app: App) {
		super({
			auto: {},
			teleop: {},
			endgame: {}
		});
	}

	render() {
		const newData: ScoreContributionData = {
			auto: {},
			teleop: {},
			endgame: {}
		};

		for (const tick of this.app.state.ticks.data) {
			console.log(tick);
			const section = tick.section;
			if (tick.action && section) {
				const action = tick.action;
				if (!action) continue;
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

		console.log(newData);

		this.set(newData);
	}
}
