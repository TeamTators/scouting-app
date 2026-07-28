/**
 * @fileoverview Generates sample data from Zod schemas.
 * @description
 * Walks supported Zod types and produces a representative placeholder value.
 */

import {
	z,
	type ZodTypeAny,
	ZodObject,
	ZodArray,
	ZodString,
	ZodNumber,
	ZodBoolean,
	ZodEnum,
	ZodLiteral,
	ZodUnion,
	ZodOptional,
	ZodNullable,
	ZodDefault,
	ZodEffects,
	ZodDate,
	ZodTuple
} from 'zod';

/**
 * Creates a sample value for a given Zod schema.
 * @param schema - Zod schema to derive a sample from.
 * @returns A sample value matching the schema shape.
 * @example
 * const schema = z.object({ name: z.string(), count: z.number() });
 * const sample = getSampleData(schema);
 */
export const getSampleData = (schema: ZodTypeAny): unknown => {
	if (schema instanceof ZodEffects) {
		return getSampleData(schema._def.schema);
	}

	if (schema instanceof ZodDefault) {
		return schema._def.defaultValue();
	}

	if (schema instanceof ZodOptional || schema instanceof ZodNullable) {
		return getSampleData(schema.unwrap());
	}

	if (schema instanceof ZodString) {
		return 'example';
	}

	if (schema instanceof ZodNumber) {
		return 42;
	}

	if (schema instanceof ZodBoolean) {
		return true;
	}

	if (schema instanceof ZodDate) {
		return new Date();
	}

	if (schema instanceof ZodLiteral) {
		return schema._def.value;
	}

	if (schema instanceof ZodEnum) {
		return schema._def.values[0];
	}

	if (schema instanceof ZodArray) {
		return [getSampleData(schema._def.type)];
	}

	if (schema instanceof ZodUnion) {
		return getSampleData(schema._def.options[0]);
	}

	if (schema instanceof ZodObject) {
		const shape = schema._def.shape();
		const result: Record<string, unknown> = {};
		for (const key in shape) {
			result[key] = getSampleData(shape[key]);
		}
		return result;
	}

	if (schema instanceof ZodTuple) {
		return (schema._def.items as z.ZodAny[]).map((item) => getSampleData(item));
	}

	// fallback for unknown or unsupported types
	return null;
};
