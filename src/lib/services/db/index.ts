/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @fileoverview IndexedDB service backed by Dexie.
 *
 * Provides schema registration and initialization helpers for client-side
 * IndexedDB storage.
 *
 * @example
 * import { _define, _init } from '$lib/services/db';
 * const users = _define('users', { name: 'string' });
 * await _init();
 */
import { browser } from '$app/environment';
import Dexie from 'dexie';
import { ComplexEventEmitter } from 'ts-utils';
import { z } from 'zod';

/**
 * Dexie database instance.
 */
export const DB = new Dexie(__APP_ENV__.indexed_db.name);

/**
 * Supported schema field types.
 */
export type SchemaFieldType =
	'string' | 'number' | 'boolean' | 'date' | 'array' | 'object' | 'unknown';

/**
 * Maps schema field types to their runtime value types.
 */
export type SchemaFieldReturnType<T extends SchemaFieldType> = T extends 'string'
	? string
	: T extends 'number'
		? number
		: T extends 'boolean'
			? boolean
			: T extends 'date'
				? Date
				: T extends 'array'
					? unknown[]
					: T extends 'object'
						? Record<string, unknown>
						: T extends 'unknown'
							? unknown
							: never;

/**
 * Schema definition mapping field names to types.
 */
export type SchemaDefinition = {
	[key: string]: SchemaFieldType;
};

let initialized = false;
let initPromise: Promise<typeof DB> | null = null;
let openedSchemaSignature = '';
let runtimeVersion = __APP_ENV__.indexed_db.version;

const pendingSchemas: { [tableName: string]: string } = {};

const globals: SchemaDefinition = {
	id: 'string',
	created_at: 'string'
	// not putting archived here since that's a supabase specific convention
	// no archived data is expected to hit the front end
};

const debug = (...args: unknown[]) => {
	if (__APP_ENV__.indexed_db.debug && browser && __APP_ENV__.indexed_db.enabled) {
		console.log('[IndexedDB]', ...args);
	}
};

/**
 * Typed table record for a schema definition.
 */
export type TableStructable<T extends SchemaDefinition> = {
	[K in keyof T]: SchemaFieldReturnType<T[K]>;
};

const parse_zod_field = (
	schema: z.ZodTypeAny
): {
	type: SchemaFieldType;
	nullable: boolean;
} => {
	debug('Parsing Zod field', schema);
	let type: SchemaFieldType = 'unknown';
	let nullable = false;

	const processSchema = (s: z.ZodTypeAny) => {
		if (s instanceof z.ZodString) type = 'string';
		else if (s instanceof z.ZodNumber) type = 'number';
		else if (s instanceof z.ZodBoolean) type = 'boolean';
		else if (s instanceof z.ZodDate) type = 'date';
		else if (s instanceof z.ZodArray) {
			throw new Error(
				'Array types are not directly supported in IndexedDB schemas. Consider using a JSON string or separate table.'
			);
		} else if (s instanceof z.ZodObject) type = 'object';
		else type = 'unknown';
	};

	if (schema instanceof z.ZodNullable || schema instanceof z.ZodOptional) {
		nullable = true;
		processSchema(schema._def.innerType);
	} else {
		processSchema(schema);
	}

	return {
		type,
		nullable
	};
};

const parse_schema = (
	schema: z.ZodTypeAny
): Record<
	string,
	{
		type: SchemaFieldType;
		nullable: boolean;
	}
> => {
	debug('Parsing Zod schema', schema);
	if (!(schema instanceof z.ZodObject)) {
		throw new Error('Schema must be a Zod object');
	}
	const shape: unknown = schema.shape;

	if (typeof shape !== 'object' || shape === null) {
		throw new Error('Schema shape must be an object');
	}
	const parsed: Record<
		string,
		{
			type: SchemaFieldType;
			nullable: boolean;
		}
	> = {};
	for (const key in shape) {
		if (['id', '_id', 'created_at', 'archived'].includes(key)) {
			continue; // Skip reserved fields
		}
		parsed[key] = parse_zod_field((shape as any)[key]);
	}
	return parsed;
};

/**
 * Defines a table schema before initialization.
 *
 * @param {string} name - Table name.
 * @param {T} schema - Schema definition.
 */
export const _define = <Schema extends z.ZodTypeAny>(name: string, schema: Schema) => {
	debug(`Defining table "${name}" with schema`, schema);

	pendingSchemas[name] = Object.keys({
		...globals,
		...parse_schema(schema)
	}).join(', ');
	initialized = false;
	return () => DB.table<z.output<Schema>>(name);
};

let timeout: ReturnType<typeof setTimeout>;

const schemaSignature = () =>
	Object.entries(pendingSchemas)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([name, schema]) => `${name}:${schema}`)
		.join('|');

/**
 * Initializes the IndexedDB database with registered schemas.
 */
export const _init = async () => {
	if (initPromise) {
		return initPromise;
	}

	initPromise = new Promise<typeof DB>((resolve, reject) => {
		if (timeout) clearTimeout(timeout);
		timeout = setTimeout(() => {
			if (!browser) reject(new Error('IndexedDB is only available in the browser'));

			const signature = schemaSignature();
			if (initialized && DB.isOpen() && openedSchemaSignature === signature) {
				return resolve(DB);
			}

			debug('Initializing IndexedDB with schemas', pendingSchemas);
			if (openedSchemaSignature && openedSchemaSignature !== signature) {
				runtimeVersion += 1;
				debug('Schema changed, bumping IndexedDB version to', runtimeVersion);
			}

			if (DB.isOpen()) {
				DB.close();
			}

			DB.version(runtimeVersion).stores(pendingSchemas);

			DB.open()
				.then(() => {
					openedSchemaSignature = signature;
					resolve(DB);
					initialized = true;
				})
				.catch((error) => {
					initialized = false;
					reject(error);
					em.emit('init');
				})
				.finally(() => {
					initPromise = null;
				});
		});
	});

	return initPromise;
};

/**
 * Emits lifecycle events for IndexedDB.
 */
export const em = new ComplexEventEmitter<{
	init: void;
}>();
