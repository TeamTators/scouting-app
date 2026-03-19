/* eslint-disable @typescript-eslint/no-explicit-any */
import path from 'path';
import configSchema from '../src/lib/server/utils/config.ts';
import { openJSON } from '../src/lib/server/utils/files.ts';
import { z } from 'zod';
import { config } from 'dotenv';
import * as inquirer from '@inquirer/prompts';
import { attemptAsync } from 'ts-utils/check';
config();

export const prompt = (config: { message: string; clear?: boolean; default?: string }) =>
	attemptAsync(async () => {
		if (config.clear) console.clear();
		const res = await inquirer.input({
			message: config.message
		});
		if (!res) {
			return config.default;
		}

		return res;
	});

const main = async () => {
	const schema = openJSON(
		path.resolve(process.cwd(), 'config', 'config.schema.json'),
		z.record(z.unknown())
	).unwrap();

	console.log('Validating config...');
	const configPath = process.env.CONFIG_PATH || 'config.json';
	const configRes = await openJSON(path.resolve(process.cwd(), configPath), z.record(z.unknown()));
	let config: any = {};
	if (configRes.isOk()) {
		config = configRes.value;
	}
	const exampleConfig = await openJSON(
		path.resolve(process.cwd(), 'config.example.json'),
		configSchema
	).unwrap();

	const result = configSchema.safeParse(config);
	if (result.success) {
		console.log('Config is valid');
		return true;
	}

	// Recursively prompt for missing/invalid values, showing schema info
	const promptValue = async (exampleValue: any, currentValue: any, path: string): Promise<any> => {
		const splitPath = path.split('.');
		// Traverse schema to get node
		let schemaNode: any = schema;
		for (const key of splitPath) {
			if (schemaNode && schemaNode.properties && schemaNode.properties[key]) {
				schemaNode = schemaNode.properties[key];
			} else if (schemaNode && schemaNode.items) {
				schemaNode = schemaNode.items;
			} else {
				schemaNode = null;
				break;
			}
		}

		// Helper to build prompt details
		const buildPromptDetails = (node: any): string => {
			if (!node) return '';
			let details = '';
			if (node.description) details += `\nDescription: ${node.description}`;
			if (node.type) details += `\nType: ${node.type}`;
			if (node.enum) details += `\nAllowed values: ${node.enum.join(', ')}`;
			if (typeof node.minimum !== 'undefined') details += `\nMinimum: ${node.minimum}`;
			if (typeof node.maximum !== 'undefined') details += `\nMaximum: ${node.maximum}`;
			if (node.format) details += `\nFormat: ${node.format}`;
			if (node.items && node.items.enum)
				details += `\nAllowed array values: ${node.items.enum.join(', ')}`;
			return details;
		};

		if (Array.isArray(exampleValue)) {
			// Prompt for array length
			let arr = Array.isArray(currentValue) ? currentValue : [];
			const exampleLength = exampleValue.length;
			const length = parseInt(
				String(
					await prompt({
						message: `Enter array length for "${path}" (example length: ${exampleLength})${buildPromptDetails(schemaNode)}`,
						clear: true
					}).unwrap()
				),
				10
			);
			arr = arr.slice(0, length);
			for (let i = 0; i < length; i++) {
				arr[i] = await promptValue(exampleValue[0], arr[i], `${path}[${i}]`);
			}
			return arr;
		} else if (typeof exampleValue === 'object' && exampleValue !== null) {
			// Prompt for each key in object
			const obj = typeof currentValue === 'object' && currentValue !== null ? currentValue : {};
			for (const key of Object.keys(exampleValue)) {
				obj[key] = await promptValue(exampleValue[key], obj[key], `${path}.${key}`);
			}
			return obj;
		} else {
			// Prompt for primitive value
			const promptMsg = `Invalid config at path "${path}". Please enter a valid value (example: ${JSON.stringify(exampleValue)})${buildPromptDetails(schemaNode)}`;
			const value = await prompt({
				message: promptMsg,
				clear: true
			}).unwrap();
			// Try to cast to correct type
			switch (typeof exampleValue) {
				case 'number':
					return Number(value);
				case 'boolean':
					return ['true', '1', 'yes', 'y'].includes(String(value).toLowerCase());
				case 'string':
					return String(value);
				default:
					return value;
			}
		}
	};

	// Walk through all issues and fix them
	for (const issue of result.error.issues) {
		const keys = issue.path;
		let current = config;
		let example = exampleConfig;
		for (let i = 0; i < keys.length - 1; i++) {
			current = (current as any)[keys[i]] = (current as any)[keys[i]] || {};
			example = (example as any)[keys[i]];
		}
		const key = keys[keys.length - 1];
		(current as any)[key] = await promptValue(
			(example as any)[key],
			(current as any)[key],
			keys.join('.')
		);
	}

	// Save the fixed config
	const fs = await import('fs');
	await fs.promises.writeFile(
		path.resolve(process.cwd(), configPath),
		JSON.stringify(config, null, 4)
	);
	console.log('Config updated and saved.');
	return true;
};

main();
