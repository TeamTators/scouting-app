import { Scouting } from './scouting';
import { attemptAsync } from 'ts-utils/check';
import { Struct } from 'drizzle-struct/back-end';
import { text } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { Account } from './account';
import { MatchSchema, TeamSchema, EventSchema } from 'tatorscout/tba';
import { AssignmentSchema } from 'tatorscout/scout-groups';
import { Loop } from 'ts-utils/loop';
import { CompressedMatchSchema as MS, type CompressedMatchSchemaType } from '../../types/match';
import { compress } from '../utils/compression';
import terminal from '../utils/terminal';
import { Queue } from 'ts-utils/queue';
import { config } from '../utils/env';

export namespace Requests {
	export const CachedRequests = new Struct({
		name: 'cached_requests',
		structure: {
			url: text('url').notNull(),
			response: text('response').notNull()
		}
	});

	const get = <T>(url: string, threshold: number, schema: z.ZodSchema<T>) => {
		return attemptAsync<T>(async () => {
			terminal.log('Requesting: ', url);
			const exists = (
				await CachedRequests.fromProperty('url', url, {
					type: 'single'
				})
			).unwrap();
			EXISTS: if (exists) {
				if (exists.created.getTime() + threshold < Date.now()) break EXISTS;
				terminal.log('Using cached data:', url);
				return schema.parse(JSON.parse(exists.data.response));
			}

			// sort servers so primary is first
			config.app_config.servers.sort((a, b) => (a.primary === b.primary ? 0 : a.primary ? -1 : 1));

			if (!config.app_config.servers.filter(s => s.data_pull).length) {
				throw new Error('No data pull servers configured');
			}

			for (const server of config.app_config.servers) {
				if (!server.data_pull) continue;
				const data = await fetch(server.domain + '/api/event-server' + url, {
					method: 'GET',
					headers: {
						'X-API-KEY': server.api_key || ''
					}
				})
					.then((res) => res.json())
					.then((json) => schema.parse(json))

				if (!data && exists) {
					terminal.log('Failed to fetch data, using cached data:', url);
					return schema.parse(JSON.parse(exists.data.response));
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
			}

			throw new Error('All servers failed to respond');
		});
	};

	export const queue = new Queue(
		async (data: { body: ArrayBuffer; matchData: Scouting.MatchData }) => {
			config.app_config.servers.sort((a, b) => Number(a.primary) - Number(b.primary));

			const res = await Promise.all(config.app_config.servers.map(async (server) => {
				const res = await fetch(server.domain + '/event-server/submit-match/compressed', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/octet-stream',
						'X-API-KEY': server.api_key,
					},
					body: data.body,
				});

				if (!res.ok) {
					terminal.error('Error submitting match data', res.status, res.statusText);
				}

				return res.ok;
			}));
			const allOk = res.every(d => d);
			if (allOk) {
				await data.matchData.delete();
			}
			return allOk;
		},
		{
			concurrency: config.match_queue.concurrency,
			interval: config.match_queue.interval,
			limit: config.match_queue.limit,
			timeout: config.match_queue.timeout,
			type: 'fifo'
		}
	);

	queue.init();

	export const submitMatch = (match: CompressedMatchSchemaType) => {
		return attemptAsync(async () => {
			const parsed = MS.safeParse(match);
			if (!parsed.success) {
				terminal.log(parsed.error);
				terminal.error('Invalid data');
				throw new Error('Invalid data: ' + JSON.stringify(match));
			}
			const body = {
				...match,
				remote: config.app_config.remote
			};
			const matchData = (
				await Scouting.Matches.new({
					body: JSON.stringify(body),
					eventKey: match.eventKey,
					team: match.team,
					compLevel: match.compLevel,
					match: match.match
				})
			).unwrap();

			const payload = compress(body).unwrap();
			const arrayBuffer = new Uint8Array(payload).buffer;

			return queue
				.enqueue({
					body: arrayBuffer,
					matchData
				})
				.unwrap();
		});
	};

	export const getAccounts = () => {
		return attemptAsync(async () => {
			const res = (
				await get(
					'/accounts',
					1000 * 60 * 60 * 24, // 1 day
					z.object({
						id: z.string(),
						username: z.string(),
						firstName: z.string(),
						lastName: z.string(),
					}),
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
					1000 * 60 * 60, // 1 hour
					z.object({
						event: EventSchema,
						teams: z.array(TeamSchema),
						matches: z.array(MatchSchema)
					}),
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
			const res = await get(`/event/${eventKey}/scout-groups`, 1000 * 60 * 60, z.object({
				groups: z.array(z.array(z.number())),
				matchAssignments: z.array(z.tuple([
					z.array(z.number()),
					z.array(z.number()),
					z.array(z.number()),
					z.array(z.number()),
					z.array(z.number()),
					z.array(z.number()),
				])),
				interferences: z.number(),
			})).unwrap();

			return AssignmentSchema.parse(res);
		});
	};

	export const ping = () => {
		return attemptAsync(async () => {
			const start = Date.now();
			const primary = config.app_config.servers.find((server) => server.primary);
			if (!primary) throw new Error('No dashboard servers configured');
			const res = await fetch(primary.domain + '/event-server/ping', {
				method: 'GET',
				headers: {
					'X-API-KEY': primary.api_key || ''
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
					1000 * 60 * 60 * 24, // 1 day
					z.array(EventSchema)
				)
			).unwrap();

			terminal.log(res);

			return z.array(EventSchema).parse(res);
		});
	};

	export const getPictures = (eventKey: string, team: number) => {
		return get(`/event/${eventKey}/team/${team}/pictures`, 1000 * 60 * 60, z.array(z.string()));
	};

	export const getRankings = (eventKey: string, team: number) => {
		return get(`/event/${eventKey}/team/${team}/rankings`, 1000 * 60 * 20, z.record(z.record(z.number())))
	};

	export const getStats = (eventKey: string, team: number) => {
		return  get(`/event/${eventKey}/team/${team}/stats`, 1000 * 60 * 20, z.record(z.record(z.number())))
	};
}

export const _requestsTable = Requests.CachedRequests.table;
