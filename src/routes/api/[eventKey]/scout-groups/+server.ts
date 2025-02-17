import { Requests } from '$lib/server/structs/requests.js';
import { auth } from '$lib/server/utils/auth.js';
import terminal from '$lib/server/utils/terminal.js';

export const GET = async (event) => {
    if (!await auth(event)) {
        return new Response('Unauthorized', { status: 401 });
    }
    const groups = await Requests.getScoutGroups(event.params.eventKey);
    if (groups.isErr()) {
        terminal.error(groups.error);
        return new Response('Error', { status: 500 });
    }

    return new Response(JSON.stringify(groups.value), { status: 200 });
};