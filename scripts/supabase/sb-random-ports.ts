import path from 'path';
import fs from 'fs';
import { str } from '../../src/lib/server/utils/env';

export default () => {
    const studio = 54323;
    const mailpit = 54324;
    const mcp = 54321;
    const postgres = 54322;


    const add = Math.floor(Math.random() * 10000);


    const files = [
        path.join(process.cwd(), str('CONFIG_PATH', true)),
        path.join(process.cwd(), 'supabase', 'config.toml'),
    ];

    for (const file of files) {
        let content = fs.readFileSync(file, 'utf-8');
        for (const port of [studio, mailpit, mcp, postgres]) {
            const newPort = port + add;
            content = content.replaceAll(port.toString(), newPort.toString());
        }
        fs.writeFileSync(file, content);
    }
};