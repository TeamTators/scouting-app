import type { CompLevel } from "tatorscout/tba";

export class MatchData {
    constructor(
        public readonly eventKey: string,
        public readonly compLevel: CompLevel,
        public readonly match: number,
        public readonly team: number,
    ) {}
}