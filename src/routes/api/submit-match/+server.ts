import { Requests } from '$lib/server/structs/requests.js';
import { auth } from '$lib/server/utils/auth.js';
import terminal from '$lib/server/utils/terminal.js';
import { CompressedMatchSchema } from '$lib/types/match.js';
import { fail } from '@sveltejs/kit';

export const POST = async (event) => {
	const respond = (message: string, status: number) =>
		new Response(JSON.stringify({ message }), { status });
	if (!(await auth(event))) {
		// return new Response('Unauthorized', { status: 401 });
		return respond('Unauthorized', 401);
	}

	const body = await event.request.json();

	const parsed = CompressedMatchSchema.safeParse(body);

	if (!parsed.success) {
		// terminal.log('parsed:', parsed);
		terminal.log('Invalid data:', parsed.error.issues);
		// return new Response('Invalid data', { status: 400 });
		return respond('Invalid data', 400);
	}

	const res = await Requests.submitMatch(parsed.data);
	if (res.isErr()) {
		terminal.error(res.error);
		// return new Response('Error', { status: 500 });
		throw fail(500, {
			message: 'Error'
		});
	}

	if (res.value) {
		// return new Response('Success', { status: 200 });
		return respond('Success', 200);
	} else {
		// return new Response('Error', { status: 500 });
		throw fail(500, {
			message: 'Error'
		});
	}
};
