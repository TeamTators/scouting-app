import { teamsFromMatch, type CompLevel, type TBAMatch } from "tatorscout/tba";
import { App } from './app';
import { AppData } from "./data-pull";

export const getAlliance = (data: {
    matches: TBAMatch[];
    matchNumber: number;
    compLevel: CompLevel;
    teamNumber: number;
}): 'red' | 'blue' | null => {
    const match = data.matches.find(
        m =>
            m.match_number === data.matchNumber &&
            m.comp_level === data.compLevel
    );

    if (!match) return null;

    const teams = teamsFromMatch(match);

    if (teams.slice(0, 4).includes(data.teamNumber)) {
        return 'red';
    }
    if (teams.slice(4).includes(data.teamNumber)) {
        return 'blue';
    }
    return null;
}


export class MatchData {
    constructor(
        public readonly app: App,
        public readonly eventKey: string,
        public readonly compLevel: CompLevel,
        public readonly match: number,
        public readonly team: number,
    ) {}

    private _matches: TBAMatch[] = [];

    getEvent() {
        return AppData.getEvent(this.eventKey);
    }

    getScoutGroups() {
        return AppData.getScoutGroups(this.eventKey);
    }

    
    /**
     * This will return the matches for the event, it will start with an empty array and then populate it with the matches from the event if it is not already populated.
     *
     * @readonly
     * @type {{}}
     */
    get matchesGetter() {
        if (!this._matches.length) {
            this.getEvent().then(event => {
                if (event.isErr()) return console.error(event.error);
                this._matches = event.value.matches;
            });
        }
        return this._matches;
    }

    next() {}

    prev() {}

    init() {
        // initialize the match data
        const _ = this.matchesGetter;
    }
}