import { Requests } from '$lib/server/structs/requests.js';
import { auth } from '$lib/server/utils/auth.js';
import terminal from '$lib/server/utils/terminal.js';
import { MatchSchema } from '$lib/types/match.js';

export const POST = async (event) => {
	const respond = (message: string, status: number) =>
		new Response(JSON.stringify({ message }), { status });
	if (!(await auth(event))) {
		// return new Response('Unauthorized', { status: 401 });
		return respond('Unauthorized', 401);
	}

	const parsed = MatchSchema.safeParse(await event.request.json());

	if (!parsed.success) {
		// return new Response('Invalid data', { status: 400 });
		return respond('Invalid data', 400);
	}

	const res = await Requests.submitMatch(parsed.data);
	if (res.isErr()) {
		terminal.error(res.error);
		// return new Response('Error', { status: 500 });
		return respond('Error', 500);
	}

	if (res.value) {
		// return new Response('Success', { status: 200 });
		return respond('Success', 200);
	} else {
		// return new Response('Error', { status: 500 });
		return respond('Error', 500);
	}
};
