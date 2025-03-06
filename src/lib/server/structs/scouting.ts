import { boolean } from 'drizzle-orm/pg-core';
import { integer } from 'drizzle-orm/pg-core';
import { text } from 'drizzle-orm/pg-core';
import { Struct } from 'drizzle-struct/back-end';
import { createEntitlement } from '../utils/entitlements';
import { attemptAsync } from 'ts-utils/check';
import { DB } from '../db';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

export namespace Scouting {
	export const Matches = new Struct({
		name: 'cached_matches',
		structure: {
			body: text('body').notNull(),

			// These are the keys that are used to identify the match,
			// If there is an issue identifying, it doesn't matter.
			eventKey: text('eventKey').notNull(),
			team: integer('team').notNull(),
			compLevel: text('compLevel').notNull(),
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
}

export const _matches = Scouting.Matches.table;
