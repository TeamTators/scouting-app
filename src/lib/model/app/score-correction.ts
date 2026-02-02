import { WritableBase } from '$lib/services/writables';
import type { App } from './app';

export type ScoreCorrectionData = {
	auto: Record<string, number>;
	teleop: Record<string, number>;
	endgame: Record<string, number>;
};

export class ScoreCorrection extends WritableBase<ScoreCorrectionData> {
	constructor(public readonly app: App) {
		super({
			auto: {},
			teleop: {},
			endgame: {}
		});
	}

	init() {}

	reset() {}

	serialize() {
		return this.data;
	}
}
