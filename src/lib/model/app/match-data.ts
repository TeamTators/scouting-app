/**
 * @fileoverview Match metadata store with helpers for event/group navigation.
 */

import { type CompLevel, type TBAMatch } from 'tatorscout/tba';
import { App } from './app';
import { AppData } from './data-pull';
import { attemptAsync } from 'ts-utils/check';
import type { Writable } from 'svelte/store';

/**
 * Writable shape for match metadata.
 */
type MD = {
	team: number;
	eventKey: string;
	compLevel: CompLevel;
	match: number;
	alliance: 'red' | 'blue' | null;
};

/**
 * Writable model for active match/event/team context.
 *
 * @implements {Writable<MD>}
 * @example
 * const md = new MatchData(app, '2026miket', 'qm', 12, 2337, 'red');
 */
export class MatchData implements Writable<MD> {
	/**
	 * Creates a match metadata store.
	 *
	 * @param {App} app - Owning app instance.
	 * @param {string} eventKey - Event key.
	 * @param {CompLevel} compLevel - Competition level.
	 * @param {number} match - Match number/set.
	 * @param {number} team - Team number.
	 * @param {'red' | 'blue' | null} alliance - Known alliance assignment.
	 */
	constructor(
		public readonly app: App,
		public eventKey: string,
		public compLevel: CompLevel,
		public match: number,
		public team: number,
		public alliance: 'red' | 'blue' | null
	) {}

	/**
	 * Current metadata snapshot.
	 *
	 * @type {MD}
	 */
	get data(): MD {
		return {
			eventKey: this.eventKey,
			match: this.match,
			team: this.team,
			compLevel: this.compLevel,
			alliance: this.alliance
		};
	}

	/**
	 * Parsed event year from `eventKey`.
	 *
	 * @type {number}
	 */
	get year() {
		return parseInt(this.eventKey.match(/^\d{4}/)?.[0] || '2023');
	}

	/**
	 * Internal writable subscribers.
	 *
	 * @private
	 * @type {Set<(data: MD) => void>}
	 */
	private readonly subscribers = new Set<(data: MD) => void>();
	/**
	 * Notifies subscribers with current data.
	 *
	 * @private
	 * @returns {void}
	 */
	private inform() {
		this.subscribers.forEach((fn) => fn(this.data));
	}

	/**
	 * Subscribes to metadata updates.
	 *
	 * @param {(data: MD) => void} fn - Subscriber callback.
	 * @returns {() => boolean} Unsubscribe callback.
	 */
	public subscribe(fn: (data: MD) => void) {
		this.subscribers.add(fn);
		fn(this.data);
		return () => this.subscribers.delete(fn);
	}

	/**
	 * Replaces metadata values.
	 *
	 * @param {MD} data - New metadata.
	 * @returns {void}
	 */
	set(data: MD) {
		this.eventKey = data.eventKey;
		this.match = data.match;
		this.team = data.team;
		this.compLevel = data.compLevel;
		this.alliance = data.alliance;
		this.inform();
	}

	/**
	 * Applies updater function to metadata.
	 *
	 * @param {(data: MD) => MD} fn - Updater callback.
	 * @returns {void}
	 */
	update(fn: (data: MD) => MD) {
		this.set(fn(this.data));
	}

	/**
	 * Cached event matches.
	 *
	 * @private
	 * @type {TBAMatch[]}
	 */
	private _matches: TBAMatch[] = [];

	/**
	 * Fetches event data bundle.
	 *
	 * @returns {ReturnType<typeof AppData.getEvent>} Event request result.
	 */
	getEvent() {
		return AppData.getEvent(this.eventKey);
	}

	/**
	 * Fetches scout group assignment data.
	 *
	 * @returns {ReturnType<typeof AppData.getScoutGroups>} Scout-group request result.
	 */
	getScoutGroups() {
		return AppData.getScoutGroups(this.eventKey);
	}

	/**
	 * This will return the matches for the event, it will start with an empty array and then populate it with the matches from the event if it is not already populated.
	 *
	 * @readonly
	 * @type {TBAMatch[]}
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

	/**
	 * Resolves team assignment for a specific scout group at current match index.
	 *
	 * @param {number} group - Scout group index.
	 * @returns {ReturnType<typeof attemptAsync<number>>} Assigned team number.
	 */
	newScoutGroup(group: number) {
		return attemptAsync<number>(async () => {
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

	/**
	 * Resolves current scout group index for this team/match.
	 *
	 * @returns {ReturnType<typeof attemptAsync<number | null>>} Group index or `null`.
	 */
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

	/**
	 * Computes metadata for the next assigned match.
	 *
	 * @returns {ReturnType<typeof attemptAsync<MD>>} Next match metadata.
	 */
	next() {
		return attemptAsync(async () => {
			if (this.compLevel === 'pr')
				return {
					...this.data,
					match: this.data.match + 1
				};
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

	/**
	 * Computes metadata for the previous assigned match.
	 *
	 * @returns {ReturnType<typeof attemptAsync<MD>>} Previous match metadata.
	 */
	prev() {
		return attemptAsync(async () => {
			if (this.compLevel === 'pr')
				return {
					...this.data,
					match: this.data.match - 1
				};
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

	/**
	 * Initializes cached event match data.
	 *
	 * @returns {() => void} Cleanup callback.
	 */
	init() {
		// initialize the match data
		const _ = this.matchesGetter;

		return () => {};
	}
}

/**
 * Resolves alliance color for a team in a specific match.
 *
 * @param {{
 * 	team: number;
 * 	eventKey: string;
 * 	compLevel: CompLevel;
 * 	match: number;
 * }} data - Lookup parameters.
 * @returns {ReturnType<typeof attemptAsync<'red' | 'blue' | null>>} Alliance lookup result.
 * @example
 * const alliance = await getAlliance({ team: 2337, eventKey: '2026miket', compLevel: 'qm', match: 3 });
 */
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
