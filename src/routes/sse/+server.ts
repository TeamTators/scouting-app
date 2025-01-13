import { sse } from '$lib/server/utils/sse';

// setInterval(() => {
// 	sse.send('ping', null);
// }, 1000);

export async function GET(event) {
	const res = await sse.connect(event);
	if (res.isErr()) {
		console.error(res.error);
		return new Response('Server Error', {
			status: 500
		});
	}
	return res.unwrap();
}
