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
				eventRes
				// groupsRes
			] = await Promise.all([
				this.getEvent()
				// this.getScoutGroups(),
			]);

			const event = eventRes.unwrap();
			// const groups = groupsRes.unwrap();

			const match = event.matches.find(
				(m) => m.comp_level === this.compLevel && m.match_number === this.match
			);
			if (!match) return null;
			const teams = teamsFromMatch(match);
			const index = teams.indexOf(this.team);
			if (index === -1) return null;
			return index;
		});
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
			const [eventRes, scoutGroupsRes] = await Promise.all([
				this.getEvent(),
				this.getScoutGroups()
			]);

			const event = eventRes.unwrap();
			const groups = scoutGroupsRes.unwrap();

			const matchIndex = event.matches.findIndex(
				(m) => m.match_number === this.match && m.comp_level === this.compLevel
			);
			const nextMatch = event.matches[matchIndex + 1];

			if (!nextMatch) return null;

			const group = groups.matchAssignments.findIndex((matches) => {
				const team = matches[matchIndex];
				return team === this.team;
			});

			if (group === -1) return null;

			const teams = teamsFromMatch(nextMatch);
			return teams[group];
		});
	}

	prev() {
		return attemptAsync(async () => {
			const [eventRes, scoutGroupsRes] = await Promise.all([
				this.getEvent(),
				this.getScoutGroups()
			]);

			const event = eventRes.unwrap();
			const groups = scoutGroupsRes.unwrap();

			const matchIndex = event.matches.findIndex(
				(m) => m.match_number === this.match && m.comp_level === this.compLevel
			);
			const prevMatch = event.matches[matchIndex - 1];

			if (!prevMatch) return null;

			const group = groups.matchAssignments.findIndex((matches) => {
				const team = matches[matchIndex];
				return team === this.team;
			});

			if (group === -1) return null;

			const teams = teamsFromMatch(prevMatch);
			return teams[group];
		});
	}

	init() {
		// initialize the match data
		const _ = this.matchesGetter;

		return () => {};
	}
}
