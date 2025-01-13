export const GET = async (event) => {
	console.log('hi');
	event.cookies.set('ssid', '123', {
		httpOnly: true,
		domain: 'localhost',
		sameSite: 'lax',
		path: '/',
		maxAge: 604800
	});
	return new Response('Hi', {
		// headers: {
		//     'Set-Cookie': 'ssid=123; HttpOnly; Domain=localhost:5173; SameSite=None; Path=/*; Expires=Wed, 21 Oct 2021 07:28:00 GMT'
		// }
	});
};
