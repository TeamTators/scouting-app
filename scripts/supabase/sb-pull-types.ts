import { runTask } from '../../src/lib/server/utils/task';
import fs from 'fs';
import ts from 'typescript';
import env from '../../src/lib/server/utils/env';
import { fromSnakeCase, capitalize, toCamelCase } from 'ts-utils';

/**
 * Generates a Zod schema string for a given schema property in a TypeScript file.
 */
export function generateZodSchemaString(tsCode: string): string {
	const sourceFile = ts.createSourceFile(
		'db.ts',
		tsCode,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS
	);

	const schemaNames = env.SB_SCHEMAS;

	function getPropertyName(name: ts.PropertyName): string {
		if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
			return name.text;
		}
		return name.getText();
	}

	function findDatabaseNode(node: ts.Node): ts.TypeLiteralNode | null {
		if (
			ts.isTypeAliasDeclaration(node) &&
			node.name.text === 'Database' &&
			ts.isTypeLiteralNode(node.type)
		) {
			return node.type;
		}

		let found: ts.TypeLiteralNode | null = null;
		ts.forEachChild(node, (child) => {
			if (found) return;
			found = findDatabaseNode(child);
		});
		return found;
	}

	const dbNode = findDatabaseNode(sourceFile);

	if (!dbNode) {
		throw new Error('Database type alias not found in generated types.');
	}

	const schemaNodes: Record<string, ts.TypeLiteralNode> = {};
	for (const schemaName of schemaNames) {
		const schemaProp = dbNode.members.find(
			(member) =>
				ts.isPropertySignature(member) &&
				member.type &&
				ts.isTypeLiteralNode(member.type) &&
				getPropertyName(member.name) === schemaName
		) as ts.PropertySignature | undefined;

		if (!schemaProp || !schemaProp.type || !ts.isTypeLiteralNode(schemaProp.type)) {
			throw new Error(`Schema "${schemaName}" not found in Database type.`);
		}

		schemaNodes[schemaName] = schemaProp.type;
	}

	const zodSchemas: Record<string, Record<string, Record<string, string>>> = {};

	function parseTypeLiteralToZod(obj: ts.TypeNode): Record<string, string> {
		if (!ts.isTypeLiteralNode(obj)) return {};

		const result: Record<string, string> = {};

		obj.members.forEach((member) => {
			if (!ts.isPropertySignature(member) || !member.type) return;

			const key = member.name.getText();
			const typeText = member.type.getText();
			let zodType = 'z.any()';

			if (typeText.includes('number')) zodType = 'z.number()';
			else if (typeText.includes('string')) zodType = 'z.string()';
			else if (typeText.includes('boolean')) zodType = 'z.boolean()';
			else if (typeText.includes('null')) zodType = 'z.null()';

			// Use .nullable() instead of .optional() for null types
			if (typeText.includes('| null')) {
				zodType += '.nullable()';
			}

			// If it has ?, it’s optional (may be undefined)
			if (member.questionToken) {
				zodType += '.optional()';
			}

			result[key] = zodType;
		});

		return result;
	}

	for (const [schemaName, schemaNode] of Object.entries(schemaNodes)) {
		const tablesProp = schemaNode.members.find(
			(member) => ts.isPropertySignature(member) && getPropertyName(member.name) === 'Tables'
		) as ts.PropertySignature | undefined;

		if (!tablesProp || !tablesProp.type || !ts.isTypeLiteralNode(tablesProp.type)) {
			throw new Error(`Tables property not found or invalid in schema "${schemaName}"`);
		}

		const zodTables: Record<string, Record<string, string>> = {};
		tablesProp.type.members.forEach((table) => {
			if (!ts.isPropertySignature(table) || !table.type || !ts.isTypeLiteralNode(table.type))
				return;

			const tableType = table.type;
			const tableName = getPropertyName(table.name);
			const tableObj: Record<string, string> = {};

			['Row', 'Insert', 'Update'].forEach((section) => {
				const sectionProp = tableType.members.find(
					(member) => ts.isPropertySignature(member) && getPropertyName(member.name) === section
				) as ts.PropertySignature | undefined;

				if (sectionProp && sectionProp.type && ts.isTypeLiteralNode(sectionProp.type)) {
					const fields = parseTypeLiteralToZod(sectionProp.type);
					const fieldsStr = Object.entries(fields)
						.map(([k, v]) => `${JSON.stringify(k)}: ${v}`)
						.join(', ');
					tableObj[section] = `z.object({ ${fieldsStr} })`;
				}
			});

			zodTables[tableName] = tableObj;
		});

		zodSchemas[schemaName] = zodTables;
	}

	const schemaStrings = Object.entries(zodSchemas)
		.map(([schemaName, tables]) => {
			const tableStrings = Object.entries(tables)
				.map(
					([tableName, sections]) =>
						`    ${JSON.stringify(tableName)}: {\n` +
						Object.entries(sections)
							.map(([sec, val]) => `      ${sec}: ${val},`)
							.join('\n') +
						'\n    }'
				)
				.join(',\n');

			return `  ${JSON.stringify(schemaName)}: {\n${tableStrings}\n  }`;
		})
		.join(',\n');

	return `import { z } from "zod";

export const schemas = {
${schemaStrings}
} as const;`;
}

export function generateClass(schema: string, table: string): string {
	const className = `${capitalize(toCamelCase(fromSnakeCase(schema)))}${capitalize(toCamelCase(fromSnakeCase(table)))}`
	return `// This file is generated by the sb:pull-types script. After it is generated, you can edit this file. This file will not be overwritten by the sb:pull-types script after it is generated.
	
import { WritableBase } from '$lib/services/writables';
import { SupaStructData } from '$lib/services/supabase/supastruct-data';
	
export class ${className} extends WritableBase<SupaStructData<${schema}, ${table}>['data']> {
	private static readonly cache = new Map<string, ${className}>();
	public static from(data: SupaStructData<${schema}, ${table}>): ${className} {
		const cacheKey = data.id;
		if (!cacheKey) throw new Error('Data must have an id to be cached.');
		
		const has = this.cache.get(cacheKey);

		if (has) return has;

		const instance = new ${className}(data);
		this.cache.set(cacheKey, instance);
		return instance;
	}

	constructor(
		public readonly structData: SupaStructData<${schema}, ${table}>
	) {
		super(structData.data);
		this.pipe(structData);
	}
	
	get id() {
		return this.data.id;
	}

	get created() {
		return this.data.created_at;
	}
}`
}

export default async (...args: string[]) => {
	// Generate the supabase types
	let contents = await runTask(
		{
			SUPABASE_DB_PASSWORD: env.SB_POSTGRES_PASSWORD
		},
		'npx',
		'supabase',
		'gen',
		'types',
		'typescript',
		'--db-url',
		env.SB_DB_URL,
		'--schema',
		env.SB_SCHEMAS.join(','),
		...args
	).unwrap();

	const databasePivotedTypeString = generateDatabasePivotedTypeString(contents);

	contents += `\n\nexport type SchemaName = keyof Database;\n\n${databasePivotedTypeString}`;

	// Save raw supabase types
	fs.writeFileSync('src/lib/types/supabase.ts', contents);

	// Generate Zod schema string
	const zodSchemaString = generateZodSchemaString(contents);

	// Save Zod schema
	fs.writeFileSync(
		'src/lib/types/supabase-zod.ts',
		`/* 
This file is generated by the supabase-gen script. Do not edit this file directly.
*/

${zodSchemaString}
`
	);
};

/**
 * Generates a strict pivoted database type from the Database type alias.
 */
export function generateDatabasePivotedTypeString(tsCode: string): string {
	const sourceFile = ts.createSourceFile(
		'db.ts',
		tsCode,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS
	);

	function getPropertyName(name: ts.PropertyName): string {
		if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
			return name.text;
		}
		return name.getText();
	}

	function findDatabaseNode(node: ts.Node): ts.TypeLiteralNode | null {
		if (
			ts.isTypeAliasDeclaration(node) &&
			node.name.text === 'Database' &&
			ts.isTypeLiteralNode(node.type)
		) {
			return node.type;
		}

		let found: ts.TypeLiteralNode | null = null;
		ts.forEachChild(node, (child) => {
			if (found) return;
			found = findDatabaseNode(child);
		});
		return found;
	}

	const dbNode = findDatabaseNode(sourceFile);

	if (!dbNode) {
		throw new Error('Database type alias not found in generated types.');
	}

	const sections = ['Row', 'Insert', 'Update', 'Relationships'] as const;

	const schemaEntries = dbNode.members
		.filter((member): member is ts.PropertySignature => {
			return (
				ts.isPropertySignature(member) &&
				!!member.type &&
				ts.isTypeLiteralNode(member.type) &&
				env.SB_SCHEMAS.includes(getPropertyName(member.name))
			);
		})
		.map((schemaMember) => {
			const schemaName = getPropertyName(schemaMember.name);
			const schemaType = schemaMember.type as ts.TypeLiteralNode;
			const tablesProp = schemaType.members.find(
				(member) =>
					ts.isPropertySignature(member) &&
					member.type &&
					ts.isTypeLiteralNode(member.type) &&
					getPropertyName(member.name) === 'Tables'
			) as ts.PropertySignature | undefined;

			if (!tablesProp || !tablesProp.type || !ts.isTypeLiteralNode(tablesProp.type)) {
				throw new Error(`Tables property not found or invalid in schema "${schemaName}"`);
			}

			const tableEntries = (tablesProp.type as ts.TypeLiteralNode).members
				.filter((m): m is ts.PropertySignature => ts.isPropertySignature(m))
				.map((tableMember) => ({
					tableName: getPropertyName(tableMember.name),
					tableTypeNode: tableMember.type as ts.TypeLiteralNode | undefined
				}));

			return { schemaName, tableEntries };
		});

	function getSectionFieldsType(
		tableTypeNode: ts.TypeLiteralNode | undefined,
		section: string
	): string {
		if (!tableTypeNode || !ts.isTypeLiteralNode(tableTypeNode)) return 'unknown';

		const sectionProp = tableTypeNode.members.find(
			(m): m is ts.PropertySignature =>
				ts.isPropertySignature(m) && getPropertyName(m.name) === section
		);

		if (!sectionProp?.type || !ts.isTypeLiteralNode(sectionProp.type)) return 'unknown';

		const fields = sectionProp.type.members
			.filter((m): m is ts.PropertySignature => ts.isPropertySignature(m) && !!m.type)
			.map((m) => {
				const fieldName = getPropertyName(m.name);
				const optional = m.questionToken ? '?' : '';
				const typeText = m.type!.getText();
				return `\t\t\t\t${JSON.stringify(fieldName)}${optional}: ${typeText};`;
			})
			.join('\n');

		return `{\n${fields}\n\t\t\t}`;
	}

	const sectionBlocks = sections.map((section) => {
		const schemaLines = schemaEntries
			.map(({ schemaName, tableEntries }) => {
				const tableLines = tableEntries
					.map(({ tableName, tableTypeNode }) => {
						const value =
							section === 'Relationships'
								? `Database[${JSON.stringify(schemaName)}]['Tables'][${JSON.stringify(tableName)}]['Relationships']`
								: getSectionFieldsType(tableTypeNode, section);
						return `\t\t\t${JSON.stringify(tableName)}: ${value};`;
					})
					.join('\n');

				return `\t\t${JSON.stringify(schemaName)}: {\n${tableLines}\n\t\t};`;
			})
			.join('\n');

		return `\t${section}: {\n${schemaLines}\n\t};`;
	});

	return `export type DatabasePivoted = {\n${sectionBlocks.join('\n')}\n};`;
}
