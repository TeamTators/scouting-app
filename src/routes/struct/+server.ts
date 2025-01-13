import { Struct } from 'drizzle-struct/back-end';

export const POST = async (event) => {
	const res = await Struct.handler(event);
	// console.log(res);
	if (res.isErr()) {
		console.error(res.error);
		return new Response(
			JSON.stringify({
				success: false,
				message: res.error.message
			}),
			{ status: 500 }
		);
	}
	return res.value;
};
