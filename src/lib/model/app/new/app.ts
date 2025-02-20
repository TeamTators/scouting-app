import type { CompLevel } from "tatorscout/tba";
import { MatchData } from "./match-data";
import { attempt } from "ts-utils/check";

export class App {
    public static deserialize(data: string) {
        return attempt(() => {});
    }

    public readonly matchData: MatchData;

    constructor(
        public readonly config: Readonly<{
            year: number,
            eventKey: string,
            match: number,
            compLevel: CompLevel,
            team: number,
        }>,
    ) {
        this.matchData = new MatchData(
            config.eventKey,
            config.compLevel,
            config.match,
            config.team,
        );
    }

    serialize() {}
}