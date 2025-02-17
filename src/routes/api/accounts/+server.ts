import { Requests } from '$lib/server/structs/requests.js';
import { auth } from '$lib/server/utils/auth.js';

export const GET = async (event) => {
    if (!await auth(event)) {
        return new Response('Unauthorized', { status: 401 });
    }

    const accounts = await Requests.getAccounts();
    if (accounts.isErr()) {
        return new Response('Error', { status: 500 });
    }

    return new Response(
        JSON.stringify(accounts.value.map(a => a.safe())),
        {
            status: 200,
        }
    )
};