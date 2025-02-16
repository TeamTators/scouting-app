import { attemptAsync } from '../../../shared/check';
import { sleep } from '../../../shared/sleep';
import { teamsFromMatch } from '../../../shared/submodules/tatorscout-calculations/tba';
import { TBAMatch } from '../../../shared/tba';
import { confirm } from '../../utilities/notifications';
import { socket } from '../../utilities/socket';
import { App } from './app';

const filter = (m: TBAMatch): number[] =>
    teamsFromMatch(m).filter((_, i) => ![3, 7].includes(i)) as number[];
// .filter(Boolean) as number[];
export class MatchData {
    public static get(): MatchData {
        const d = window.localStorage.getItem('matchData');
        if (!d) return new MatchData();
        const data = JSON.parse(d) as {
            matchNumber: number;
            teamNumber: number;
            compLevel: 'pr' | 'qm' | 'qf' | 'sf' | 'f';
            group: number;
        };
        return new MatchData(
            +data.matchNumber,
            +data.teamNumber,
            data.compLevel,
            +data.group
        );
    }

    constructor(
        public $matchNumber: number = 0,
        public $teamNumber: number = 0,
        public $compLevel: 'pr' | 'qm' | 'qf' | 'sf' | 'f' = 'qm',
        public $group: number = -1
    ) {}

    public get matchNumber() {
        return this.$matchNumber;
    }

    private set matchNumber(matchNumber: number) {
        this.$matchNumber = +matchNumber;
        this.save();
    }

    public get teamNumber() {
        return this.$teamNumber;
    }

    private set teamNumber(teamNumber: number) {
        this.$teamNumber = +teamNumber;
        this.save();
    }

    public get group() {
        return this.$group;
    }

    public set group(group: number) {
        this.$group = +group;
        this.save();
    }

    public async getAlliance(): Promise<'red' | 'blue' | null> {
        const res = await App.getEventData();
        if (res.isErr()) return null;

        const { matches } = res.value;
        const match = matches.find(
            m =>
                m.match_number === this.matchNumber &&
                m.comp_level === this.compLevel
        );

        if (!match) return null;

        const teams = teamsFromMatch(match);

        if (teams.slice(0, 4).includes(this.teamNumber)) {
            return 'red';
        }
        if (teams.slice(4).includes(this.teamNumber)) {
            return 'blue';
        }
        return null;
    }

    public get compLevel() {
        return this.$compLevel;
    }

    public set compLevel(compLevel: 'pr' | 'qm' | 'qf' | 'sf' | 'f') {
        this.$compLevel = compLevel;
        this.save();
    }

    private save() {
        console.log('saving');
        window.localStorage.setItem(
            'matchData',
            JSON.stringify({
                matchNumber: +this.$matchNumber,
                teamNumber: +this.$teamNumber,
                compLevel: this.$compLevel,
                group: +this.group
            })
        );

        App.emit('select-match', this);

        App.updateState();
    }

    async getCurrentMatch() {
        return attemptAsync(async () => {
            const eventData = await App.getEventData();
            if (eventData.isErr()) throw eventData.error;

            const match = eventData.value.matches.find(
                m =>
                    m.match_number === this.matchNumber &&
                    m.comp_level === this.compLevel
            );

            return match;
        });
    }

    async selectGroup(group: number, matchIndex?: number, doConfirm = true) {
        return attemptAsync(async () => {
            console.log('App.matchData.selectGroup');
            const eventData = await App.getEventData();
            if (eventData.isErr()) throw eventData.error;

            const match = matchIndex
                ? eventData.value.matches[matchIndex]
                : eventData.value.matches.find(
                      m =>
                          m.match_number === this.matchNumber &&
                          m.comp_level === this.compLevel
                  );

            console.log('match', match);

            if (!match) throw new Error('Match not found');

            const changeGroup = async (num: number) => {
                console.log('changeGroup', num);
                const index =
                    matchIndex || eventData.value.matches.indexOf(match);
                if (num >= 6) throw new Error('Group not found');

                this.teamNumber =
                    eventData.value.assignments.matchAssignments[num][index];

                console.log('this.teamNumber', this.teamNumber);

                this.group = num;
            };

            if (doConfirm && group !== this.group) {
                const doThis = await confirm(
                    'Are you sure you want to change groups?'
                );
                console.log('doThis', doThis);
                if (!doThis) return changeGroup(this.group);
            }
            changeGroup(group);
        });
    }

    async selectMatch(
        matchNumber: number,
        compLevel: 'qm' | 'qf' | 'sf' | 'f' | 'pr',
        teamNumber?: number
    ) {
        return attemptAsync(async () => {
            console.log('selectMatch', matchNumber, compLevel, teamNumber);
            if (compLevel === 'pr') {
                this.compLevel = 'pr';
                this.matchNumber = matchNumber;
                this.teamNumber = teamNumber || 0;
                this.save();
                return;
            }

            const current = this.matchNumber;
            const currentTeam = this.teamNumber;
            const indexMove = matchNumber - current;
            const result = await this.moveIndex(indexMove);
            if (result.isErr()) throw result.error;

            const currentMatch = await this.getCurrentMatch();
            if (currentMatch.isErr()) throw currentMatch.error;

            if (currentMatch.value) {
                console.log('Found match', currentMatch.value);
                if (teamNumber) {
                    console.log('teamNumber', teamNumber);
                    const teams = teamsFromMatch(currentMatch.value).filter(
                        Boolean
                    );
                    if (teams.includes(teamNumber)) {
                        console.log('includes');
                        this.teamNumber = teamNumber;
                    } else {
                        console.log('does not include', teams[0]);
                        this.teamNumber = teams[0];
                    }
                    this.matchNumber = matchNumber;
                    this.compLevel = compLevel;
                    console.log(
                        'changing state',
                        this.teamNumber,
                        this.matchNumber
                    );
                } else {
                    const teams = teamsFromMatch(currentMatch.value).filter(
                        Boolean
                    );
                    this.matchNumber = matchNumber;
                    this.compLevel = compLevel;

                    console.log(
                        'changingState',
                        this.matchNumber,
                        this.compLevel
                    );

                    const m = await this.getCurrentMatch();
                    if (m.isErr()) throw m.error;
                    if (!m.value) throw new Error('Match not found');
                    const newTeams = teamsFromMatch(m.value).filter(Boolean);
                    console.log('newTeams', newTeams);
                    let index = teams.indexOf(currentTeam);
                    if (index === -1) index = 0;
                    console.log('index', index);
                    this.teamNumber = newTeams[index];
                    console.log('this.teamNumber', this.teamNumber);
                }
            }

            this.save();

            return result.value;
        });
    }

    async moveIndex(movingMatchIndex: number) {
        return attemptAsync(async () => {
            if (this.compLevel === 'pr') this.compLevel = 'qm'; // Default to qual matches
            const eventData = await App.getEventData();
            if (eventData.isErr()) throw eventData.error;
            const { group } = App;

            let currentMatchIndex = eventData.value.matches.findIndex(
                m =>
                    m.match_number === this.matchNumber &&
                    m.comp_level === this.compLevel
            );

            // always start at match = 0 if no match is selected
            if (currentMatchIndex === -1 && movingMatchIndex !== 1)
                currentMatchIndex = 0;

            const prev = eventData.value.matches[currentMatchIndex];
            const prevTeams = filter(prev);
            currentMatchIndex += movingMatchIndex;

            const match = eventData.value.matches[currentMatchIndex];

            if (!match) {
                throw new Error('Match not found, match not changed');
            }

            const teams: number[] = filter(match);

            if (group === -1) {
                // if no group and is red 1, stay red 1
                const teamIndex = prevTeams.indexOf(this.teamNumber) || 0;
                this.teamNumber = teams[teamIndex];
            } else {
                this.teamNumber =
                    eventData.value.assignments.matchAssignments[group][
                        currentMatchIndex
                    ];
            }

            this.matchNumber = match.match_number;

            this.save();
        });
    }

    async prev() {
        return this.moveIndex(-1);
    }

    async next() {
        return this.moveIndex(1);
    }
}
