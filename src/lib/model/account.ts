import { attemptAsync } from 'ts-utils/check';
import { sse } from '$lib/utils/sse';
import {
	Struct,
	type PartialStructable,
	type Structable,
	type GlobalCols,
	StructData,
	SingleWritable
} from 'drizzle-struct/front-end';
import { Requests } from '$lib/utils/requests';

export namespace Account {
	export const Account = new Struct({
		name: 'account',
		structure: {
			username: 'string',
			key: 'string',
			salt: 'string',
			firstName: 'string',
			lastName: 'string',
			email: 'string',
			picture: 'string',
			verified: 'boolean',
			verification: 'string'
		},
		socket: sse
	});

	export type AccountData = StructData<typeof Account.data.structure>;

	export const self = new SingleWritable<typeof Account.data.structure>(
		Account.Generator({
			username: 'Guest',
			key: '',
			salt: '',
			firstName: 'Guest',
			lastName: '',
			email: '',
			picture: '',
			verified: false,
			verification: '',
			id: 'guest',
			updated: '0',
			created: '0',
			archived: false,
			universes: '[]',
			attributes: '[]',
			lifetime: 0
		})
	);

	export const getSelf = (): SingleWritable<typeof Account.data.structure> => {
		attemptAsync(async () => {
			const data = (
				await Requests.get<
					PartialStructable<typeof Account.data.structure> & Structable<GlobalCols>
				>('/account/self', {
					expectStream: false
				})
			).unwrap();

			self.set(Account.Generator(data));
		});

		return self;
	};
}
