import path from 'path';
import fs from 'fs';
import { str } from '../../src/lib/server/utils/env';

export default () => {
	const range = (min: number, max: number) =>
		Array.from({ length: max - min + 1 }, (_, i) => min + i);

	const add = Math.floor(Math.random() * 10000);
	console.log(`Adding ${add} to Supabase ports...`);

	const files = [
		path.join(process.cwd(), str('CONFIG_PATH', true)),
		path.join(process.cwd(), 'supabase', 'config.toml')
	];

	for (const file of files) {
		let content = fs.readFileSync(file, 'utf-8');
		console.log(`Updating ports in ${file} by adding ${add}...`);
		console.log('Current:', content);
		for (const port of range(54320, 54340)) {
			const newPort = port + add;
			content = content.replaceAll(port.toString(), newPort.toString());
		}
		console.log('Updated:', content);
		fs.writeFileSync(file, content);
	}
};
