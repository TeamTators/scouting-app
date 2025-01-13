import { type Handle } from '@sveltejs/kit';
import { Struct } from 'drizzle-struct/back-end';
import { match } from 'ts-utils/match';

type Proof = 'string' | 'number' | 'boolean' | ((data: unknown) => boolean);

export const require =
	<T extends Record<string, unknown>>(
		data: {
			[K in keyof T]: Proof;
		},
		fn: (data: T) => unknown
	) =>
	(body: unknown) => {
		if (typeof body !== 'object') {
			throw new Error('Invalid body');
		}
		if (!body) {
			throw new Error('Invalid body');
		}
		const b = body as T;
		for (const key in data) {
			const proof = data[key];
			if (typeof proof === 'function') {
				if (!proof(b[key])) {
					throw new Error(`Invalid ${key}`);
				}
			} else {
				if (typeof b[key] !== proof) {
					throw new Error(`Invalid ${key}`);
				}
			}
		}
		return fn(b);
	};

export const post: Handle = async ({ event, resolve }) => {
	if (event.url.pathname.startsWith('/webhook')) {
		try {
			const split = event.url.pathname.split('/');
			split.shift(); // remove webhook
			const [struct, action] = split;
			const s = Struct.structs.get(struct);
			if (!s) {
				return new Response('Invalid struct', { status: 400 });
			}
			const body = (await event.request.json()) as unknown;
			match(action).exec().unwrap();
		} catch (error) {
			return new Response((error as Error).message, { status: 500 });
		}
	}

	return resolve(event);
};
