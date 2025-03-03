import { teamsFromMatch, type CompLevel, type TBAMatch } from 'tatorscout/tba';
import { App } from './app';
import { AppData } from './data-pull';
import type { Assignment } from 'tatorscout/scout-groups';
import { attemptAsync } from 'ts-utils/check';
import type { Writable } from 'svelte/store';

export const getAlliance = (data: {
	matches: TBAMatch[];
	matchNumber: number;
	compLevel: CompLevel;
	teamNumber: number;
}): 'red' | 'blue' | null => {
	const match = data.matches.find(
		(m) => m.match_number === data.matchNumber && m.comp_level === data.compLevel
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
};

type MD = {
	team: number;
	eventKey: string;
	compLevel: CompLevel;
	match: number;
};

export class MatchData implements Writable<MD> {
	constructor(
		public readonly app: App,
		public eventKey: string,
		public compLevel: CompLevel,
		public match: number,
		public team: number
	) {}

	get data(): MD {
		return {
			eventKey: this.eventKey,
			match: this.match,
			team: this.team,
			compLevel: this.compLevel
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

	getScoutGroup() {
		return attemptAsync<number | null>(async () => {
			const [
				eventRes,
				groupsRes
			] = await Promise.all([
				this.getEvent(),
				this.getScoutGroups(),
			]);

			const event = eventRes.unwrap();
			const groups = groupsRes.unwrap();

			const match = event.matches.findIndex(
				(m) => {
					if (this.eventKey !== m.event_key) return false;
					if (m.comp_level !== this.compLevel) return false;
					if (m.comp_level === 'sf') return m.set_number === this.match;
					return m.match_number === this.match;
				}
			);
			if (match === -1) return null;
			for (let i = 0; i < groups.matchAssignments.length; i++) {
				if (groups.matchAssignments[i][match] === this.team) return i;
			}
			return null;
		});
	}

	getAlliance() {
		const match = this.matchesGetter.find(m => m.comp_level === this.compLevel && this.compLevel === 'sf' ? m.set_number === this.match : m.match_number === this.match);
		if (!match) return null;
		const teams = teamsFromMatch(match);
		if (teams.slice(0, 4).includes(this.team)) return 'red';
		if (teams.slice(4).includes(this.team)) return 'blue';
		return null;
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

	next() {
		return attemptAsync(async () => {
			const [eventRes, scoutGroupsRes, currentGroup] = await Promise.all([
				this.getEvent(),
				this.getScoutGroups(),
				this.getScoutGroup(),
			]);

			const event = eventRes.unwrap();
			const groups = scoutGroupsRes.unwrap();
			const group = currentGroup.unwrap();
			if (typeof group !== 'number') throw new Error('Group not found');

			const matchIndex = event.matches.findIndex(m => {
				if (this.eventKey !== m.event_key) return false;
				if (m.comp_level !== this.compLevel) return false;
				if (m.comp_level === 'sf') return m.set_number === this.match;
				return m.match_number === this.match;
			});

			const next = event.matches[matchIndex + 1];
			if (!next) throw new Error('No Next Match');

			const nextTeam = groups.matchAssignments[group][matchIndex + 1];
			if (!nextTeam) throw new Error('No Next Team');

			return {
				team: nextTeam,
				match: next.match_number,
				compLevel: next.comp_level as CompLevel,
				eventKey: this.eventKey,
			}
		});
	}

	prev() {
		return attemptAsync(async () => {
			const [eventRes, scoutGroupsRes, currentGroup] = await Promise.all([
				this.getEvent(),
				this.getScoutGroups(),
				this.getScoutGroup(),
			]);

			const event = eventRes.unwrap();
			const groups = scoutGroupsRes.unwrap();
			const group = currentGroup.unwrap();
			if (typeof group !== 'number') throw new Error('Group not found');

			const matchIndex = event.matches.findIndex(m => {
				if (this.eventKey !== m.event_key) return false;
				if (m.comp_level !== this.compLevel) return false;
				if (m.comp_level === 'sf') return m.set_number === this.match;
				return m.match_number === this.match;
			});

			const prev = event.matches[matchIndex - 1];
			if (!prev) throw new Error('No Prev Match');

			const prevTeam = groups.matchAssignments[group][matchIndex - 1];
			if (!prevTeam) throw new Error('No Prev Team');

			return {
				team: prevTeam,
				match: prev.match_number,
				compLevel: prev.comp_level as CompLevel,
				eventKey: this.eventKey,
			}
		});
	}

	init() {
		// initialize the match data
		const _ = this.matchesGetter;

		return () => {};
	}
}
