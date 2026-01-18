import { config } from '$lib/server/utils/env';
import { fail } from '@sveltejs/kit';
import fs from 'fs/promises';
import path from 'path';
import mime from 'mime-types';

export const GET = async (e) => {
    const { id } = e.params;

    const filepath = path.join(
        process.cwd(),
        '/assets/uploads',
        path.basename(id),
    );

    try {
        const exists = await fs.readFile(
            filepath
        );
	    // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return new Response(exists as any, {
            headers: {
                'Content-Type': mime.lookup(filepath) || 'application/octet-stream',
                'Content-Disposition': `inline; filename=${path.basename(id)}`
            }
        });
    } catch {
        //
    }

    const imageServers = config.app_config.servers.filter(s => s.images);

    for (const server of imageServers) {
        const res = await fetch(server.domain + id);

        if (res.ok) {
            const file = await res.blob();
            await fs.writeFile(filepath, Buffer.from(await file.arrayBuffer()))
            return res;
        }
    }

    throw fail(404);
};