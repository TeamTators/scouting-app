import { WritableBase } from "$lib/writables";
import type { App } from "./app";

export type ScoreCorrectionData = {
    auto: Record<string, number>;
    teleop: Record<string, number>;
};

export class ScoreCorrection extends WritableBase<ScoreCorrectionData> {
    constructor(public readonly app: App) {
        super({
            auto: {},
            teleop: {}
        });
    }

    init() {}

    reset() {}

    serialize() {
        return this.data;
    }
}