import { sse } from '$lib/server/services/sse.js';
import { json } from '@sveltejs/kit';
import clients from '$lib/server/services/clients.js';
import { TabletState } from '$lib/types/tablet-state.js';

export const POST = async (event) => {
    const { id, state } = event.params;
    const url = event.url.searchParams.get('url');
    if (!Object.keys(TabletState).includes(state) || !url) {
        return json({ success: false });
    }
    sse.send('tablet-state', { id, state, url });
    clients.setState(id, state, url);
    return json({ success: true });
}