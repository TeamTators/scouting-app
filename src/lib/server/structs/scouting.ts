import { integer } from 'drizzle-orm/pg-core';
import { text } from 'drizzle-orm/pg-core';
import { Struct } from 'drizzle-struct';
import { attemptAsync } from 'ts-utils/check';
import { DB } from '../db';
import { and, eq } from 'drizzle-orm';
import { Requests } from './requests';
import type { CompressedMatchSchemaType } from '$lib/types/match';

export namespace Scouting {
	export const Matches = new Struct({
		name: 'cached_matches',
		structure: {
			body: text('body').notNull(),

			// These are the keys that are used to identify the match,
			// If there is an issue identifying, it doesn't matter.
			eventKey: text('event_key').notNull(),
			team: integer('team').notNull(),
			compLevel: text('comp_level').notNull(),
			match: integer('match').notNull()
		}
	});

	export type MatchData = typeof Matches.sample;

	export const retrieveMatches = (data: {
		eventKey: string;
		team: number;
		compLevel: string;
		match: number;
	}) => {
		return attemptAsync(async () => {
			const res = await DB.select()
				.from(Matches.table)
				.where(
					and(
						eq(Matches.table.eventKey, data.eventKey),
						eq(Matches.table.team, data.team),
						eq(Matches.table.compLevel, data.compLevel),
						eq(Matches.table.match, data.match)
					)
				);

			return res.map((r) => Matches.Generator(r));
		});
	};

	export const submitStale = (event: string) => {
		Matches.get(
			{ eventKey: event },
			{
				type: 'stream'
			}
		).pipe((m) => Requests.submitMatch(JSON.parse(m.data.body) as CompressedMatchSchemaType));

		return Requests.queue.flush();
	};
}

export const _matches = Scouting.Matches.table;
