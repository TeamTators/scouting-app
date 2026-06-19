import clients from '$lib/server/services/clients.js';
import { json } from '@sveltejs/kit';

export const GET = async (event) => {
    if (!event.locals.isTrusted) return json([]);
    const state = clients.getState();  
    return json(state);
};