import { Requests } from '$lib/server/structs/requests.js';
import { auth } from '$lib/server/utils/auth.js';
import terminal from '$lib/server/utils/terminal.js';

export const GET = async (event) => {
    if (!await auth(event)) {
        return new Response('Unauthorized', { status: 401 });
    }

    const e = await Requests.getEvent(event.params.eventKey);

    if (e.isErr()) {
        terminal.error(e.error);
        return new Response('Error', { status: 500 });
    }

    return new Response(JSON.stringify(e.value), { status: 200 });
};