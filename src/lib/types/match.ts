import { TraceSchema } from 'tatorscout/trace';
import { z } from 'zod';
export const MatchSchema = z.object({
	trace: TraceSchema,
	eventKey: z.string(),
	match: z.number().int(),
	team: z.number().int(),
	compLevel: z.enum(['pr', 'qm', 'qf', 'sf', 'f']),
	flipX: z.boolean(),
	flipY: z.boolean(),
	checks: z.array(z.string()),
	comments: z.record(z.string()),
	scout: z.string(),
	prescouting: z.boolean(),
	practice: z.boolean(),
	alliance: z.union([z.literal('red'), z.literal('blue'), z.literal(null)]),
	group: z.number().int(),
	sliders: z.record(
		z.string(),
		z.object({
			value: z.number().int().min(0).max(5),
			text: z.string(),
			color: z.string()
		})
	)
});
export type MatchSchemaType = z.infer<typeof MatchSchema>;

export const CompressedMatchSchema = z.object({
	trace: z.string(),
	eventKey: z.string(),
	match: z.number().int(),
	team: z.number().int(),
	compLevel: z.enum(['pr', 'qm', 'qf', 'sf', 'f']),
	flipX: z.boolean(),
	flipY: z.boolean(),
	checks: z.array(z.string()),
	comments: z.record(z.string()),
	scout: z.string(),
	prescouting: z.boolean(),
	practice: z.boolean(),
	alliance: z.union([z.literal('red'), z.literal('blue'), z.literal(null)]),
	group: z.number().int(),
	sliders: z.record(
		z.string(),
		z.object({
			value: z.number().int().min(0).max(5),
			text: z.string(),
			color: z.string()
		})
	)
});

export type CompressedMatchSchemaType = z.infer<typeof CompressedMatchSchema>;
