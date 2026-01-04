import { AssignmentSchema } from 'tatorscout/scout-groups';
import { EventSchema, MatchSchema, TeamSchema } from 'tatorscout/tba';
import { attemptAsync } from 'ts-utils/check';
import { z } from 'zod';
import { downloadText, loadFileContents } from '$lib/utils/downloads';
import {
	CompressedMatchSchema as CMS,
	type CompressedMatchSchemaType,
	MatchSchema as MS
} from '$lib/types/match';
import { notify } from '$lib/utils/prompts';
import { Trace } from 'tatorscout/trace';

export namespace AppData {
	const CACHE_VERSION = 'v2';

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
				const response = await fetch('/api' + url, {
					method: 'GET'
				});

				if (!response.ok) throw new Error('Failed to fetch data');
				const data = await response.json();

				localStorage.setItem(
					`${CACHE_VERSION}:${url}`,
					JSON.stringify({
						timestamp: Date.now(),
						data: data
					})
				);

				return data;
			} catch (error) {
				if (d) return d;
				throw new Error(`Failed to fetch data: ${url} ${error}`);
			}
		});
	};

	const post = async (url: string, body: unknown) => {
		return attemptAsync(async () => {
			const res = await fetch('/api' + url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(body)
			});

			if (!res.ok) throw new Error('Failed to post data');
			return res.json();
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

	export const getEvents = (year: number) => {
		return attemptAsync(async () => {
			const res = (await get(`/events/${year}`, 1000 * 60 * 60 * 24)).unwrap();
			return z.array(EventSchema).parse(res);
		});
	};

	export const getScoutGroups = (eventKey: string) => {
		return attemptAsync(async () => {
			const res = (await get(`/event/${eventKey}/scout-groups`, 1000 * 60 * 60)).unwrap();

			return AssignmentSchema.parse(res);
		});
	};
	// const saveMatches = (data: MatchSchemaType[]) => {
	// 	return attempt(() => {
	// 		const saved = localStorage.getItem(CACHE_VERSION + 'saved-matches') || '[]';
	// 		const parsed = z.array(MS).parse(JSON.parse(saved));
	// 		parsed.push(...data);
	// 		localStorage.setItem(CACHE_VERSION + 'saved-matches', JSON.stringify(parsed));
	// 	});
	// };

	// const getMatches = () => {
	// 	return attempt<MatchSchemaType[]>(() => {
	// 		const saved = localStorage.getItem(CACHE_VERSION + 'saved-matches') || '[]';
	// 		return z.array(MS).parse(JSON.parse(saved)) as MatchSchemaType[];
	// 	});
	// };

	const downloadMatch = (data: CompressedMatchSchemaType) => {
		return downloadText(
			JSON.stringify(data),
			`${data.eventKey}:${data.compLevel}:${data.match}:${data.team}.${CACHE_VERSION}.match`
		);
	};

	export const uploadMatch = () => {
		return attemptAsync(async () => {
			const matches = (await loadFileContents()).unwrap();
			// it would probably be a good idea to have this filter,
			// but because we are dealing with duplicates and files save as .txt,
			// I'm getting rid of it.
			// .filter((f) => f.name.endsWith(`.${CACHE_VERSION}.match`));
			return Promise.all(
				matches.map(async (m) => {
					const parsed = CMS.safeParse(JSON.parse(m.text));
					if (parsed.success) {
						return (await submitMatch(parsed.data, false)).unwrap();
					} else {
						const parsed = MS.safeParse(JSON.parse(m.text));
						if (parsed.success) {
							const data = {
								...parsed.data,
								trace: Trace.parse(parsed.data.trace).unwrap().serialize(true),
							};

							return (await downloadMatch(data)).unwrap();
						}
					}
				})
			);
		});
	};

	export const submitMatch = (data: CompressedMatchSchemaType, download: boolean) => {
		return attemptAsync(async () => {
			// const matches = getMatches().unwrap();
			// saveMatches([...matches, data]).unwrap();
			if (download) (await downloadMatch(data)).unwrap();
			const res = await post('/submit-match', data);
			if (res.isOk()) {
				notify({
					title: 'Match Submitted',
					message: `Match ${data.eventKey}:${data.compLevel}${data.match} submitted successfully!`,
					color: 'success',
					autoHide: 3000
				});
			} else {
				notify({
					title: 'Match Submission Failed',
					message: `Match ${data.eventKey}:${data.compLevel}${data.match} failed to submit!`,
					color: 'danger',
					autoHide: 3000
				});
			}
		});
	};
}
