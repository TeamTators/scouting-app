import type { Action } from "tatorscout/trace";
import { App, SECTIONS, TICKS_PER_SECOND, type Section } from "./app";
import type { Point2D } from "math/point";

export class Tick {
    public action: Action | null = null;
    public point: Point2D | null = null;

    constructor(
        public readonly time: number,
        public readonly index: number,
        public readonly app: App,
    ) {}

    public get second() {
        return Math.round(this.index / TICKS_PER_SECOND);
    }

    public get section() {
        for (const [section, range] of Object.entries(SECTIONS)) {
            const [start, end] = range as number[];
            if (this.second >= start && this.second <= end) {
                return section as Section;
            }
        }

        return null;
    }

    clear() {
        this.action = null;
        this.point = null;
    }
}