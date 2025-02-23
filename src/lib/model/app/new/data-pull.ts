import { AssignmentSchema } from "tatorscout/scout-groups";
import { EventSchema, MatchSchema, TeamSchema } from "tatorscout/tba";
import { attemptAsync } from "ts-utils/check";
import { z } from "zod";



export namespace AppData {
    const CACHE_VERSION = 'v1';

    const get = async(url: string, threshold: number) => {
        return attemptAsync<unknown>(async () => {
            const exists = localStorage.getItem(`${CACHE_VERSION}:${url}`);
            let d: unknown;
            if (exists) {
                try {
                    const { data, timestamp } = z.object({
                        timestamp: z.number().int(),
                        data: z.unknown(),
                    }).parse(JSON.parse(exists));
                    d = data;
                    if (timestamp + threshold > Date.now()) return data;
                } catch (error) {
                    console.error('Cached item is corrupted:', url, error);
                    localStorage.removeItem(`${CACHE_VERSION}:${url}`);
                }
            }

            try {
                const res = await fetch('/api' + url, {
                    method: 'GET',
                }).then(r => r.json());
    
                localStorage.setItem(`${CACHE_VERSION}:${url}`, JSON.stringify({
                    timestamp: Date.now(),
                    data: res,
                }));
    
                return res;
            } catch (error) {
                if (d) return d;
                throw new Error(`Failed to fetch data: ${url} ${error}`);
            }
        });
    };

    export const getAccounts = () => {
        return attemptAsync(async () => {
            const res = (await get('/accounts', 1000 * 60 * 60 * 24)).unwrap();

            return z.array(z.object({
                id: z.string(),
                username: z.string(),
                firstName: z.string(),
                lastName: z.string(),
            })).parse(res);
        });
    }

    export const getEvent = (eventKey: string) => {
        return attemptAsync(async () => {
            const res = (await get(`/accounts/${eventKey}`, 1000 * 60 * 60)).unwrap();

            return z.object({
                event: EventSchema,
                matches: z.array(MatchSchema),
                teams: z.array(TeamSchema),
            }).parse(res);
        });
    };

    export const getScoutGroups = (eventKey: string) => {
        return attemptAsync(async () => {
            const res = (await get(`/accounts/${eventKey}/scout-groups`, 1000 * 60 * 60 * 24)).unwrap();

            return AssignmentSchema.parse(res);
        });
    };

    export const submitMatch = () => {
        return attemptAsync(async () => {});
    };
}