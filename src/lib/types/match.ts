import { TraceSchema } from 'tatorscout/trace';
import { z } from 'zod';
export const MatchSchema = z.object({
	checks: z.array(z.string()),
	comments: z.record(z.string(), z.string()),
	matchNumber: z.number().int(),
	teamNumber: z.number().int(),
	compLevel: z.enum(['pr', 'qm', 'qf', 'sf', 'f']),
	eventKey: z.string(),
	scout: z.string(),
	group: z.number().int(),
	trace: TraceSchema,
	prescouting: z.boolean(),
	alliance: z.union([z.literal('red'), z.literal('blue'), z.literal(null)])
});
export type MatchSchemaType = z.infer<typeof MatchSchema>;
