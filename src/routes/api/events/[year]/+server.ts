import { Requests } from '$lib/server/structs/requests.js';
import terminal from '$lib/server/utils/terminal.js';

export const GET = async (event) => {
	const res = await Requests.getEvents(parseInt(event.params.year));
	terminal.log(res);
	if (res.isOk()) {
		return new Response(JSON.stringify(res.value), { status: 200 });
	} else {
		return new Response(JSON.stringify(res.error), { status: 500 });
	}
};
