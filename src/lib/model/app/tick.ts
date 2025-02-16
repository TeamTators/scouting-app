import { ActionState } from './app-object';
import { Point2D } from '../../../shared/submodules/calculations/src/linear-algebra/point';
import { Action } from '../../../shared/submodules/tatorscout-calculations/trace';
import { CollectedData } from './app';
import { App } from './app';
import { Section } from './app';

/**
 * Tick of the match
 * @date 1/9/2024 - 3:08:20 AM
 *
 * @export
 * @class Tick
 * @typedef {Tick}
 */
export class Tick<actions = Action> {
    /**
     * Data collected at this tick
     * @date 1/9/2024 - 3:08:20 AM
     *
     * @private
     * @type {CollectedData}
     */
    private data: CollectedData<actions> | null = null;

    /**
     * Point of the robot at this tick
     * @date 1/9/2024 - 3:08:20 AM
     *
     * @public
     * @type {(Point2D | null)}
     */
    public point: Point2D | null = null;

    /**
     * Creates an instance of Tick.
     * @date 1/9/2024 - 3:08:20 AM
     *
     * @constructor
     * @param {number} time
     * @param {number} index
     * @param {App} app
     */
    constructor(
        public readonly time: number,
        public readonly index: number,
        public readonly app: App
    ) {}

    /**
     * Nearest second
     * @date 1/9/2024 - 3:08:20 AM
     *
     * @public
     * @readonly
     * @type {number}
     */
    public get second(): number {
        // console.log(this.index);
        return Math.round(this.index / App.ticksPerSecond);
    }

    /**
     * Section of the match
     * @date 1/9/2024 - 3:08:20 AM
     *
     * @public
     * @readonly
     * @type {(Section | null)}
     */
    public get section(): Section | null {
        for (const [section, range] of Object.entries(App.sections)) {
            const [start, end] = range as number[];
            if (this.second >= start && this.second <= end) {
                return section as Section;
            }
        }

        return null;
    }

    /**
     * Set the data collected at this tick
     * @date 1/9/2024 - 3:08:20 AM
     *
     * @public
     * @param {CollectedData} data
     */
    public set(data: CollectedData) {
        if (this.data instanceof ActionState) {
            this.next()?.set(data); // set next tick's data
            return;
        }
        this.data = data;

        if (data instanceof ActionState) {
            data.tick = this;
        }
    }

    /**
     * Removes data collected at this tick
     * @date 1/25/2024 - 4:59:07 PM
     *
     * @public
     */
    public clear() {
        if (this.data instanceof ActionState) {
            this.data.tick = null;
        }

        this.data = null;
    }

    /**
     * Get the data collected at this tick
     * @date 1/9/2024 - 3:08:20 AM
     *
     * @public
     * @returns {CollectedData}
     */
    public get(): CollectedData {
        return this.data;
    }

    /**
     * returns the next tick
     * @date 1/9/2024 - 3:08:20 AM
     *
     * @public
     * @returns {(Tick | undefined)}
     */
    public next(): Tick | undefined {
        return this.app.ticks[this.index + 1];
    }

    /**
     * returns the previous tick
     * @date 1/9/2024 - 3:08:20 AM
     *
     * @public
     * @returns {(Tick | undefined)}
     */
    public prev(): Tick | undefined {
        return this.app.ticks[this.index - 1];
    }
}
