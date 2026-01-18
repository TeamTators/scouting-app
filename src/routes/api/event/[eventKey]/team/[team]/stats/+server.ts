import { fail, json } from '@sveltejs/kit';
import { Requests } from '$lib/server/structs/requests.js';

export const GET = async (event) => {
    const { eventKey, team } = event.params;
    if (isNaN(Number(team))) {
        throw fail(400);
    }

    const res = await Requests.getStats(eventKey, parseInt(team)).unwrap();

    return json(res);
};