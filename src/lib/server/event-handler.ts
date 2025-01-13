import type { RequestAction } from 'drizzle-struct/back-end';
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
	Struct,
	StructError,
	DataError,
	StructStream,
	StructData,
	type Structable,
	globalCols
} from 'drizzle-struct/back-end';
import { PropertyAction, DataAction } from 'drizzle-struct/types';
import { Account } from './structs/account';
import { Session } from './structs/session';
import { Permissions } from './structs/permissions';
import { encode } from 'ts-utils/text';
import { sse } from '$lib/server/utils/sse';

export const handleEvent =
	(struct: Struct) =>
	async (event: RequestAction): Promise<Response> => {
		const error = (error: Error) =>
			new Response(
				JSON.stringify({
					success: false,
					message: error.message
				}),
				{ status: 200 }
			);
		const s = (await Session.getSession(event.request)).unwrap();
		if (!s) return error(new StructError('Session not found'));

		let roles: Permissions.RoleData[] = [];
		let account: Account.AccountData | undefined;
		let isAdmin = false;

		if (struct.data.name !== 'test') {
			account = (await Session.getAccount(s)).unwrap();
			if (!account) return error(new StructError('Not logged in'));

			roles = (await Permissions.getRoles(account)).unwrap();
			isAdmin = !!(
				await Account.Admins.fromProperty('accountId', account.id, {
					type: 'single'
				})
			).unwrap();
		}

		const invalidPermissions = error(new StructError('Invalid permissions'));

		const bypass = struct.bypasses
			.filter((b) => b.action === event.action || b.action === '*')
			.map((b) => b.condition);

		const runBypass = (
			data?: StructData<typeof struct.data.structure, typeof struct.data.name>
		) => {
			if (!account && struct.data.name === 'test') return true;
			if (!account) return false;
			if (isAdmin) return true;
			for (const fn of bypass) {
				const res = fn(account, data);
				if (res) return res;
			}
			return false;
		};

		if (event.action === DataAction.ReadVersionHistory) {
			if (!Object.hasOwn(event.data as any, 'id'))
				return error(new DataError('Missing ReadVersionHistory id'));
			const data = (await struct.fromId(String((event.data as any).id))).unwrap();
			if (!data) return error(new DataError('Data not found'));
			const history = (await data.getVersions()).unwrap();
			return new Response(
				JSON.stringify({
					success: true,
					data: history.map((v) => v.data)
				}),
				{ status: 200 }
			);
		}

		if (event.action === DataAction.DeleteVersion) {
			if (!Object.hasOwn(event.data as any, 'id'))
				return error(new DataError('Missing DeleteVersion id'));
			if (!Object.hasOwn(event.data as any, 'vhId'))
				return error(new DataError('Missing DeleteVersion version'));
			const data = (await struct.fromId(String((event.data as any).id))).unwrap();
			if (!data) return error(new DataError('Data not found'));
			const version = (await data.getVersions())
				.unwrap()
				.find((v) => v.vhId === (event.data as any).vhId);
			if (!version) return error(new DataError('Version not found'));

			(await version.delete()).unwrap();

			return new Response(
				JSON.stringify({
					success: true
				}),
				{ status: 200 }
			);
		}

		if (event.action === DataAction.RestoreVersion) {
			if (!Object.hasOwn(event.data as any, 'id'))
				return error(new DataError('Missing RestoreVersion id'));
			if (!Object.hasOwn(event.data as any, 'vhId'))
				return error(new DataError('Missing RestoreVersion version'));
			const data = (await struct.fromId(String((event.data as any).id))).unwrap();
			if (!data) return error(new DataError('Data not found'));
			const versions = (await data.getVersions())
				.unwrap()
				.find((v) => v.vhId === (event.data as any).vhId);
			if (!versions) return error(new DataError('Version not found'));
			const res = await versions.restore();
			if (res.isErr()) return error(res.error);

			return new Response(
				JSON.stringify({
					success: true
				}),
				{ status: 200 }
			);
		}

		if (event.action === PropertyAction.Read) {
			if (!Object.hasOwn(event.data as any, 'type'))
				return error(new DataError('Missing Read type'));
			if (
				(event.data as any).type !== 'all' &&
				(event.data as any).type !== 'archived' &&
				!Object.hasOwn(event.data as any, 'args')
			)
				return error(new DataError('Missing Read args'));

			let streamer: StructStream<typeof struct.data.structure, typeof struct.data.name>;
			const type = (event.data as any).type as
				| 'all'
				| 'archived'
				| 'from-id'
				| 'property'
				| 'universe';
			switch (type) {
				case 'all':
					streamer = struct.all({
						type: 'stream'
					});
					break;
				case 'archived':
					streamer = struct.archived({
						type: 'stream'
					});
					break;
				case 'from-id':
					if (!Object.hasOwn((event.data as any).args, 'id'))
						return error(new DataError('Missing Read id'));
					{
						const data = (await struct.fromId((event.data as any).args.id)).unwrap();
						if (!data) return error(new DataError('Data not found'));
						return new Response(
							JSON.stringify({
								success: true,
								data: data.data
							}),
							{ status: 200 }
						);
					}
				case 'property':
					if (!Object.hasOwn((event.data as any).args, 'key'))
						return error(new DataError('Missing Read key'));
					if (!Object.hasOwn((event.data as any).args, 'value'))
						return error(new DataError('Missing Read value'));
					streamer = struct.fromProperty(
						(event.data as any).args.key,
						(event.data as any).args.value,
						{
							type: 'stream'
						}
					);
					break;
				case 'universe':
					if (!Object.hasOwn((event.data as any).args, 'universe'))
						return error(new DataError('Missing Read universe'));
					streamer = struct.fromUniverse((event.data as any).args.universe, {
						type: 'stream'
					});
					break;
				default:
					return error(new DataError('Invalid Read type'));
			}

			let readable: ReadableStream;

			if (account) {
				readable = new ReadableStream({
					start(controller) {
						streamer.on('end', () => {
							// console.log('end');
							controller.enqueue('end\n\n');
							controller.close();
						});

						if (runBypass()) {
							streamer.pipe((d) => controller.enqueue(`${encode(JSON.stringify(d.data))}\n\n`));
							return;
						}
						const stream = Permissions.filterActionPipeline(
							account,
							roles,
							streamer as any,
							PropertyAction.Read,
							bypass
						);
						stream.pipe((d) => controller.enqueue(`${encode(JSON.stringify(d))}\n\n`));
					},
					cancel() {
						streamer.off('end');
						streamer.off('data');
						streamer.off('error');
					}
				});
			} else if (struct.data.name === 'test') {
				readable = new ReadableStream({
					start(controller) {
						streamer.on('end', () => {
							// console.log('end');
							controller.enqueue('end\n\n');
							controller.close();
						});

						streamer.pipe((d) => controller.enqueue(`${encode(JSON.stringify(d.data))}\n\n`));
					},
					cancel() {
						streamer.off('end');
						streamer.off('data');
						streamer.off('error');
					}
				});
			} else {
				return error(new StructError('Not logged in'));
			}

			return new Response(readable, {
				status: 200,
				headers: {
					'Content-Type': 'text/event-stream'
				}
			});
		}

		if (event.action === DataAction.Create) {
			const create = async () => {
				if (
					!struct.validate(event.data, {
						optionals: [
							'id',
							'created',
							'updated',
							'archived',
							'universes',
							'attributes',
							'lifetime'
						]
					})
				)
					return error(new DataError('Invalid data'));

				(await struct.new(event.data as any)).unwrap();
				return new Response(
					JSON.stringify({
						success: true
					}),
					{ status: 201 }
				);
			};
			if (runBypass()) {
				return create();
			}
			if (!Permissions.canDo(roles, this as any, DataAction.Create).unwrap())
				return invalidPermissions;

			return create();
		}

		if (event.action === PropertyAction.Update) {
			delete (event.data as any).created;
			delete (event.data as any).updated;
			delete (event.data as any).archived;
			delete (event.data as any).universes;
			delete (event.data as any).attributes;
			delete (event.data as any).lifetime;

			const data = event.data as Structable<typeof struct.data.structure & typeof globalCols>;
			const found = (await struct.fromId(String(data.id))).unwrap();
			if (!found) return error(new DataError('Data not found'));

			if (runBypass()) {
				const res = await found.update(data);
				if (res.isErr()) return error(res.error);
			} else {
				const [res] = (
					await Permissions.filterAction(roles, [found as any], PropertyAction.Update)
				).unwrap();
				if (!res) return invalidPermissions;
				const updateRes = await found.update(
					Object.fromEntries(Object.entries(data).filter(([k]) => res[k])) as any
				);
				if (updateRes.isErr()) return error(updateRes.error);
			}

			return new Response(
				JSON.stringify({
					success: true
				}),
				{ status: 200 }
			);
		}

		if (event.action === DataAction.Archive) {
			const archive = async () => {
				if (!Object.hasOwn(event.data as any, 'id')) return error(new DataError('Missing id'));

				const data = event.data as Structable<typeof struct.data.structure & typeof globalCols>;
				const found = (await struct.fromId(String(data.id))).unwrap();
				if (!found) return error(new DataError('Data not found'));

				(await found.setArchive(true)).unwrap();

				return new Response(
					JSON.stringify({
						success: true
					}),
					{ status: 200 }
				);
			};
			if (runBypass()) return archive();
			if (!Permissions.canDo(roles, this as any, DataAction.Create).unwrap())
				return invalidPermissions;
			return archive();
		}

		if (event.action === DataAction.Delete) {
			const remove = async () => {
				if (!Object.hasOwn(event.data as any, 'id')) return error(new DataError('Missing id'));

				const data = event.data as Structable<typeof struct.data.structure & typeof globalCols>;
				const found = (await struct.fromId(String(data.id))).unwrap();
				if (!found) return error(new DataError('Data not found'));

				(await found.delete()).unwrap();
				return new Response(
					JSON.stringify({
						success: true
					}),
					{ status: 200 }
				);
			};
			if (runBypass()) return remove();
			if (!Permissions.canDo(roles, this as any, DataAction.Create).unwrap())
				return invalidPermissions;

			return remove();
		}

		if (event.action === DataAction.RestoreArchive) {
			const restore = async () => {
				if (!Object.hasOwn(event.data as any, 'id')) return error(new DataError('Missing id'));
				const data = event.data as Structable<typeof struct.data.structure & typeof globalCols>;
				const found = (await struct.fromId(String(data.id))).unwrap();
				if (!found) return error(new DataError('Data not found'));

				await found.setArchive(false);

				return new Response(
					JSON.stringify({
						success: true
					}),
					{ status: 200 }
				);
			};
			if (runBypass()) return restore();
			if (!Permissions.canDo(roles, this as any, DataAction.Create).unwrap())
				return invalidPermissions;
			return restore();
		}

		return error(new StructError('Invalid action'));
	};

export const connectionEmitter = (struct: Struct) => {
	// Permission handling
	const emitToConnections = async (
		event: string,
		data: StructData<typeof struct.data.structure, typeof struct.data.name>
	) => {
		sse.each(async (connection) => {
			if (struct.name === 'test') {
				connection.send(`struct:${struct.name}`, {
					event,
					data: data.data
				});
				return;
			}
			const session = await connection.getSession();
			if (session.isErr()) return console.error(session.error);
			const s = session.value;
			if (!s) return;

			const account = await Session.getAccount(s);
			if (account.isErr()) return console.error(account.error);
			const a = account.value;
			if (!a) return;

			if (
				(
					await Account.Admins.fromProperty('accountId', a.id, {
						type: 'single'
					})
				).unwrap()
			) {
				connection.send(`struct:${struct.name}`, {
					event,
					data: data.data
				});
				return;
			}

			const roles = await Permissions.getRoles(a);
			if (roles.isErr()) return console.error(roles.error);
			const r = roles.value;

			const res = await Permissions.filterAction(r, [data as any], PropertyAction.Read);
			if (res.isErr()) return console.error(res.error);
			const [result] = res.value;
			connection.send(`struct:${struct.name}`, {
				event,
				data: result
			});
		});
	};

	struct.on('create', (data) => {
		emitToConnections('create', data);
	});

	struct.on('update', (data) => {
		emitToConnections('update', data);
	});

	struct.on('archive', (data) => {
		emitToConnections('archive', data);
	});

	struct.on('delete', (data) => {
		emitToConnections('delete', data);
	});

	struct.on('restore', (data) => {
		emitToConnections('restore', data);
	});

	struct.emit('build', undefined);
};
