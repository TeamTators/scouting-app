import { teamsFromMatch, type CompLevel, type TBAMatch } from 'tatorscout/tba';
import { App } from './app';
import { AppData } from './data-pull';
import type { Assignment } from 'tatorscout/scout-groups';
import { attemptAsync } from 'ts-utils/check';
import type { Writable } from 'svelte/store';

type MD = {
	team: number;
	eventKey: string;
	compLevel: CompLevel;
	match: number;
	alliance: 'red' | 'blue' | null;
};

export class MatchData implements Writable<MD> {
	constructor(
		public readonly app: App,
		public eventKey: string,
		public compLevel: CompLevel,
		public match: number,
		public team: number,
		public alliance: 'red' | 'blue' | null
	) {}

	get data(): MD {
		return {
			eventKey: this.eventKey,
			match: this.match,
			team: this.team,
			compLevel: this.compLevel,
			alliance: this.alliance
		};
	}

	get year() {
		return parseInt(this.eventKey.match(/^\d{4}/)?.[0] || '2023');
	}

	private readonly subscribers = new Set<(data: MD) => void>();
	private inform() {
		this.subscribers.forEach((fn) => fn(this.data));
	}

	public subscribe(fn: (data: MD) => void) {
		this.subscribers.add(fn);
		fn(this.data);
		return () => this.subscribers.delete(fn);
	}

	set(data: MD) {
		this.eventKey = data.eventKey;
		this.match = data.match;
		this.team = data.team;
		this.compLevel = data.compLevel;
		this.alliance = data.alliance;
		this.inform();
	}

	update(fn: (data: MD) => MD) {
		this.set(fn(this.data));
	}

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
			this.getEvent().then((event) => {
				if (event.isErr()) return console.error(event.error);
				this._matches = event.value.matches;
			});
		}
		return this._matches;
	}

	newScoutGroup(group: number) {
		return attemptAsync(async () => {
			const [eventRes, scoutGroupsRes] = await Promise.all([
				this.getEvent(),
				this.getScoutGroups()
			]);

			const event = eventRes.unwrap();
			const groups = scoutGroupsRes.unwrap();

			const matchIndex = event.matches.findIndex((m) => {
				if (this.eventKey !== m.event_key) return false;
				if (m.comp_level !== this.compLevel) return false;
				if (m.comp_level === 'sf') return m.set_number === this.match;
				return m.match_number === this.match;
			});

			if (matchIndex === -1) throw new Error('Match not found');

			const t = groups.matchAssignments[group][matchIndex];
			if (!t) throw new Error('Team not found');
			return t;
		});
	}

	getScoutGroup() {
		return attemptAsync(async () => {
			if (this.compLevel === 'pr') return null;

			const [eventRes, scoutGroupsRes] = await Promise.all([
				this.getEvent(),
				this.getScoutGroups()
			]);

			const event = eventRes.unwrap();
			const groups = scoutGroupsRes.unwrap();

			const matchIndex = event.matches.findIndex((m) => {
				if (this.eventKey !== m.event_key) return false;
				if (m.comp_level !== this.compLevel) return false;
				if (m.comp_level === 'sf') return m.set_number === this.match;
				return m.match_number === this.match;
			});

			if (matchIndex === -1) throw new Error('Match not found');

			for (let i = 0; i < groups.matchAssignments.length; i++) {
				if (groups.matchAssignments[i][matchIndex] === this.team) return i;
			}
			return null;
		});
	}

	next() {
		return attemptAsync(async () => {
			if (this.compLevel === 'pr') return {
				...this.data,
				match: this.data.match + 1,
			}
			const [eventRes, scoutGroupsRes, currentGroup] = await Promise.all([
				this.getEvent(),
				this.getScoutGroups(),
				this.getScoutGroup()
			]);

			const event = eventRes.unwrap();
			const groups = scoutGroupsRes.unwrap();
			const group = currentGroup.unwrap();
			if (typeof group !== 'number') throw new Error('Group not found');

			const matchIndex = event.matches.findIndex((m) => {
				if (this.eventKey !== m.event_key) return false;
				if (m.comp_level !== this.compLevel) return false;
				if (m.comp_level === 'sf') return m.set_number === this.match;
				return m.match_number === this.match;
			});

			const next = event.matches[matchIndex + 1];
			if (!next) throw new Error('No Next Match');

			const nextTeam = groups.matchAssignments[group][matchIndex + 1];
			if (!nextTeam) throw new Error('No Next Team');

			const alliance = next.alliances.red.team_keys.includes(`frc${nextTeam}`) ? 'red' : 'blue';

			return {
				team: nextTeam,
				match: next.match_number,
				compLevel: next.comp_level as CompLevel,
				eventKey: this.eventKey,
				alliance: alliance as 'red' | 'blue'
			};
		});
	}

	prev() {
		return attemptAsync(async () => {
			if (this.compLevel === 'pr') return {
				...this.data,
				match: this.data.match - 1,
			}
			const [eventRes, scoutGroupsRes, currentGroup] = await Promise.all([
				this.getEvent(),
				this.getScoutGroups(),
				this.getScoutGroup()
			]);

			const event = eventRes.unwrap();
			const groups = scoutGroupsRes.unwrap();
			const group = currentGroup.unwrap();
			if (typeof group !== 'number') throw new Error('Group not found');

			const matchIndex = event.matches.findIndex((m) => {
				if (this.eventKey !== m.event_key) return false;
				if (m.comp_level !== this.compLevel) return false;
				if (m.comp_level === 'sf') return m.set_number === this.match;
				return m.match_number === this.match;
			});

			const prev = event.matches[matchIndex - 1];
			if (!prev) throw new Error('No Prev Match');

			const prevTeam = groups.matchAssignments[group][matchIndex - 1];
			if (!prevTeam) throw new Error('No Prev Team');

			const alliance = prev.alliances.red.team_keys.includes(`frc${prevTeam}`) ? 'red' : 'blue';

			return {
				team: prevTeam,
				match: prev.match_number,
				compLevel: prev.comp_level as CompLevel,
				eventKey: this.eventKey,
				alliance: alliance as 'red' | 'blue'
			};
		});
	}

	init() {
		// initialize the match data
		const _ = this.matchesGetter;

		return () => {};
	}
}

export const getAlliance = (data: {
	team: number;
	eventKey: string;
	compLevel: CompLevel;
	match: number;
}) => {
	return attemptAsync(async () => {
		const res = (await AppData.getEvent(data.eventKey)).unwrap();
		const m = res.matches.find((m) => {
			if (m.comp_level !== data.compLevel) return false;
			if (m.event_key !== data.eventKey) return false;
			if (m.comp_level === 'sf') {
				return m.set_number === data.match;
			}
			return m.match_number === data.match;
		});

		console.log(m);

		if (m) {
			return m.alliances.red.team_keys.includes(`frc${data.team}`) ? 'red' : 'blue';
		} else {
			return null;
		}
	});
};
