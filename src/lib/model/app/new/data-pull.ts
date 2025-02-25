import { AssignmentSchema } from 'tatorscout/scout-groups';
import { EventSchema, MatchSchema, TeamSchema, type CompLevel } from 'tatorscout/tba';
import { attempt, attemptAsync } from 'ts-utils/check';
import { z } from 'zod';
import { downloadText, loadFileContents } from '$lib/utils/downloads';

export namespace AppData {
	const CACHE_VERSION = 'v1';

	const get = async (url: string, threshold: number) => {
		return attemptAsync<unknown>(async () => {
			const exists = localStorage.getItem(`${CACHE_VERSION}:${url}`);
			let d: unknown;
			if (exists) {
				try {
					const { data, timestamp } = z
						.object({
							timestamp: z.number().int(),
							data: z.unknown()
						})
						.parse(JSON.parse(exists));
					d = data;
					if (timestamp + threshold > Date.now()) return data;
				} catch (error) {
					console.error('Cached item is corrupted:', url, error);
					localStorage.removeItem(`${CACHE_VERSION}:${url}`);
				}
			}

			try {
				const res = await fetch('/api' + url, {
					method: 'GET'
				}).then((r) => r.json());

				localStorage.setItem(
					`${CACHE_VERSION}:${url}`,
					JSON.stringify({
						timestamp: Date.now(),
						data: res
					})
				);

				return res;
			} catch (error) {
				if (d) return d;
				throw new Error(`Failed to fetch data: ${url} ${error}`);
			}
		});
	};

	const post = async (url: string, body: unknown) => {
		return attemptAsync(async () => {
			await fetch('/api' + url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(body),
			}).then(r => r.json());
		});
	};

	export const getAccounts = () => {
		return attemptAsync(async () => {
			const res = (await get('/accounts', 1000 * 60 * 60 * 24)).unwrap();

			return z
				.array(
					z.object({
						id: z.string(),
						username: z.string(),
						firstName: z.string(),
						lastName: z.string()
					})
				)
				.parse(res);
		});
	};

	export const getEvent = (eventKey: string) => {
		return attemptAsync(async () => {
			const res = (await get(`/event/${eventKey}`, 1000 * 60 * 60)).unwrap();

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
			const res = (await get(`/event/${eventKey}/scout-groups`, 1000 * 60 * 60 * 24)).unwrap();

			return AssignmentSchema.parse(res);
		});
	};

	type Match = {
		eventKey: string;
		match: number;
		team: number;
		compLevel: CompLevel;
		flipX: boolean;
		flipY: boolean;
		checks: string[];
		comments: Record<string, string>;
	};

	const matchSchema = z.object({
		eventKey: z.string(),
		match: z.number().int(),
		team: z.number().int(),
		compLevel: z.enum(['pr', 'qm', 'qf', 'sf', 'f']),
		flipX: z.boolean(),
		flipY: z.boolean(),
		checks: z.array(z.string()),
		comments: z.record(z.string()),
	});

	const saveMatches = (data: Match[]) => {
		return attempt(() => {
			const saved = localStorage.getItem(CACHE_VERSION + 'saved-matches') || '[]';
			const parsed = z.array(matchSchema).parse(JSON.parse(saved));
			parsed.push(...data);
			localStorage.setItem(CACHE_VERSION + 'saved-matches', JSON.stringify(parsed));
		});
	};

	const getMatches = () => {
		return attempt<Match[]>(() => {
			const saved = localStorage.getItem(CACHE_VERSION + 'saved-matches') || '[]';
			return z.array(matchSchema).parse(JSON.parse(saved));
		});
	}

	const downloadMatch = (data: Match) => {
		return downloadText(JSON.stringify(data), `${data.eventKey}:${data.compLevel}:${data.match}:${data.team}.${CACHE_VERSION}.match`)
	}

	export const uploadMatch = () => {
		return attemptAsync(async () => {
			const matches = (await loadFileContents()).unwrap().filter(f => f.name.endsWith(`.${CACHE_VERSION}.match`));
			return Promise.all(matches.map(async m => {
				const parsed = matchSchema.safeParse(JSON.parse(m.text));
				if (parsed.success) {
					return (await submitMatch(parsed.data)).unwrap();
				}
			}));
		});
	};

	export const submitMatch = (data: Match) => {
		return attemptAsync(async () => {
			const matches = getMatches().unwrap();
			saveMatches([...matches, data]).unwrap();
			(await downloadMatch(data)).unwrap();
			return (await post('/submit-match', data)).unwrap();
		});
	};
}
