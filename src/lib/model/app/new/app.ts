import type { CompLevel } from "tatorscout/tba";
import { MatchData } from "./match-data";
import { attempt } from "ts-utils/check";
import { Tick } from "./tick";
import { AppState } from "./state";
import { AppView } from "./view";
import { Timer } from "./timer";
import { EventEmitter } from "ts-utils/event-emitter";

export const TICKS_PER_SECOND = 4;
export const SECTIONS = {
    auto: [0, 15],
    teleop: [16, 135],
    endgame: [136, 150],
    end: [151, 160],
};
export type Section = 'auto' | 'teleop' | 'endgame' | 'end';
export const TICK_DURATION = 1 / TICKS_PER_SECOND;


export class App {
    private readonly emitter = new EventEmitter<{
        tick: Tick;
        section: Section;
    }>();

    public readonly on = this.emitter.on.bind(this.emitter);
    public readonly off = this.emitter.off.bind(this.emitter);
    public readonly once = this.emitter.once.bind(this.emitter);
    public readonly emit = this.emitter.emit.bind(this.emitter);

    public readonly matchData: MatchData;
    public readonly ticks: Tick[];
    public readonly state: AppState;
    public readonly view: AppView;

    constructor(
        public readonly config: Readonly<{
            year: number;
            eventKey: string;
            match: number;
            compLevel: CompLevel;
            team: number;
            alliance: 'red' | 'blue' | null;
            target: HTMLElement;
        }>,
    ) {
        this.matchData = new MatchData(
            config.eventKey,
            config.compLevel,
            config.match,
            config.team,
            config.alliance,
        );

        this.ticks = Array.from({ length: 150 * TICKS_PER_SECOND}, (_, i) => new Tick(
            i * TICK_DURATION,
            i,
            this,
        ));

        this.state = new AppState(this);
        this.view = new AppView(this);
    }

    serialize() {}

    init() {
        this.state.init();
        this.view.init();
    }
}