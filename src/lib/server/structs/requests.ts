import { Scouting } from './scouting';
import { attemptAsync } from 'ts-utils/check';
// import { SECRET_SERVER_API_KEY, SECRET_SERVER_DOMAIN } from "$env/static/private";
import { Struct } from 'drizzle-struct/back-end';
import { text } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { Account } from './account';
import { MatchSchema, TeamSchema, EventSchema } from 'tatorscout/tba';
import { AssignmentSchema } from 'tatorscout/scout-groups';
import { Loop } from 'ts-utils/loop';
import { TraceSchema } from 'tatorscout/trace';
import { MatchSchema as MS, type MatchSchemaType } from '../../types/match';
import terminal from '../utils/terminal';

const { SECRET_SERVER_API_KEY, SECRET_SERVER_DOMAIN, REMOTE } = process.env;
export namespace Requests {
	const post = (url: string, data: unknown) => {
		return attemptAsync(async () => {
			const res = await fetch(SECRET_SERVER_DOMAIN + '/event-server' + url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-API-KEY': SECRET_SERVER_API_KEY || ''
				},
				body: JSON.stringify(data)
			});

			if (res.ok) return true;
			else throw new Error('Failed to send data');
		});
	};

	export const CachedRequests = new Struct({
		name: 'cached_requests',
		structure: {
			url: text('url').notNull(),
			response: text('response').notNull()
		}
	});

	const get = (url: string, threshold: number) => {
		return attemptAsync<unknown>(async () => {
			terminal.log('Requesting: ', url);
			const exists = (
				await CachedRequests.fromProperty('url', url, {
					type: 'single'
				})
			).unwrap();
			EXISTS: if (exists) {
				if (exists.created.getTime() + threshold < Date.now()) break EXISTS;
				terminal.log('Using cached data:', url);
				return JSON.parse(exists.data.response);
			}

			const data = await fetch(SECRET_SERVER_DOMAIN + '/event-server' + url, {
				method: 'GET',
				headers: {
					'X-API-KEY': SECRET_SERVER_API_KEY || ''
				}
			})
				.then((res) => res.json())
				.catch((e) => {
					console.log(e);
				});

			if (!data && exists) {
				terminal.log('Failed to fetch data, using cached data:', url);
				return JSON.parse(exists.data.response);
			}

			// terminal.log('Recieved:', data);
			if (exists) {
				terminal.log('Updating cached data:', url);
				(
					await exists.update({
						response: JSON.stringify(data)
					})
				).unwrap();
			} else {
				terminal.log('Caching data:', url);
				(
					await CachedRequests.new({
						url,
						response: JSON.stringify(data)
					})
				).unwrap();
			}
			terminal.log('Fetched data:', url);
			return data;
		});
	};

	export const submitMatch = (match: MatchSchemaType) => {
		return attemptAsync(async () => {
			const ok = MatchSchema.safeParse(match).success;
			if (!ok) throw new Error('Invalid data: ' + JSON.stringify(match));
			const body = {
				...match,
				remote: REMOTE === 'true'
			};
			(
				await Scouting.Matches.new({
					body: JSON.stringify(body),
					eventKey: match.eventKey,
					team: match.teamNumber,
					compLevel: match.compLevel,
					match: match.matchNumber
				})
			).unwrap();

			return (await post('/submit-match', body)).unwrap();
		});
	};

	export const getAccounts = () => {
		return attemptAsync(async () => {
			const res = (
				await get(
					'/accounts',
					1000 * 60 * 60 * 24 // 1 day
				)
			).unwrap();

			const parsed = z.array(z.unknown()).parse(res);
			// using any because it gets validated inside of Generator
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			return parsed.map((p) => Account.Account.Generator(p as any));
		});
	};

	export const getEvent = (eventKey: string) => {
		return attemptAsync(async () => {
			const res = (
				await get(
					`/event/${eventKey}`,
					1000 * 60 * 60 // 1 hour
				)
			).unwrap();

			return z
				.object({
					event: EventSchema,
					matches: z.array(MatchSchema),
					teams: z.array(TeamSchema)
				})
				.parse(res);
		});
	};

	export const getScoutGroups = (eventKey: string) => {
		return attemptAsync(async () => {
			const res = (
				await get(
					`/event/${eventKey}/scout-groups`,
					1000 * 60 * 60 * 24 // 1 day
				)
			).unwrap();

			return AssignmentSchema.parse(res);
		});
	};

	export const ping = () => {
		return attemptAsync(async () => {
			const start = Date.now();
			const res = await fetch(SECRET_SERVER_DOMAIN + '/api/ping', {
				method: 'GET',
				headers: {
					'X-AUTH-KEY': SECRET_SERVER_API_KEY || ''
				}
			});

			if (!res.ok) throw new Error('Failed to ping server');
			return Date.now() - start;
		});
	};

	export const createPinger = () => {
		let connected = false;
		const loop = new Loop<{
			connected: undefined;
			disconnected: undefined;
		}>(
			async () => {
				const res = await ping();
				if (res.isOk()) {
					if (!connected) {
						loop.emit('connected', undefined);
					}
					connected = true;
				} else {
					if (connected) {
						loop.emit('disconnected', undefined);
					}
					connected = false;
				}
			},
			1000 * 60 * 1
		);
		return loop;
	};

	export const getEvents = (year: number) => {
		return attemptAsync(async () => {
			const res = (
				await get(
					`/events/${year}`,
					1000 * 60 * 60 * 24 // 1 day
				)
			).unwrap();

			terminal.log(res);

			return z.array(EventSchema).parse(res);
		});
	};
}

export const _requestsTable = Requests.CachedRequests.table;
