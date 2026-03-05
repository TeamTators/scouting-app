import path from 'path';
import terminal from '../src/lib/server/utils/terminal';
import fs from 'fs/promises';
import { select, prompt } from '../cli/utils';
import { createServer } from 'vite';

// Convert import.meta.url to a file path

const main = async () => {
	let [, , file, ...args] = process.argv;

	if (!file) {
		const scripts = (await fs.readdir(path.join(process.cwd(), 'scripts'))).filter(
			(s) => s.endsWith('.ts') && s !== 'index.ts'
		);
		const chosen = (
			await select({
				message: 'Select a script to run',
				options: scripts.map((s) => ({
					name: s,
					value: s
				}))
			})
		).unwrap();
		if (!chosen) {
			process.exit();
		}
		file = chosen;
		args =
			(
				await prompt({
					message: 'Enter arguments (space separated)'
				})
			)
				.unwrap()
				?.split(' ') ?? [];
	}

	terminal.log('Running file:', file);

	// const res = await runTs(path.join('scripts', file), 'default', ...args);

	// const res = await import(path.join(process.cwd(), 'scripts', file)).then((mod) => {
	// 	if (!mod.default) {
	// 		throw new Error(`Script ${file} does not have a default export`);
	// 	}
	// 	return mod.default(...args);
	// });
	// console.log('Result:', res);

	const server = await createServer({
		configFile: path.join(process.cwd(), 'vite.config.ts'),
		server: {
			middlewareMode: true
		}
	});
	const mod = await server.ssrLoadModule(path.join(process.cwd(), 'scripts', file));
	if (!mod.default) {
		throw new Error(`Script ${file} does not have a default export`);
	}
	const res = await mod.default(...args);
	console.log('Result:', res);
	server.close();
	process.exit(0);
};

// Vite-specific check: is this the entry module?

if (!globalThis.__vite_node_entry || globalThis.__vite_node_entry === import.meta.url) {
	main();
}
