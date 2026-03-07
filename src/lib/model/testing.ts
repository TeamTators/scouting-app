import supabase from '$lib/services/supabase';
import { SupaStruct } from '$lib/services/supabase/supastruct';
import { WritableArray, WritableBase } from '$lib/services/writables';
import { REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';

export class Test extends WritableBase<{
	pending: boolean;
	message: string;
	name: string;
	success: boolean | undefined;
}> {}

export const runTests = () => {
	const struct = SupaStruct.get({
		name: 'test',
		client: supabase,
		debug: true
	});

	// struct.setupListeners();

	const realtime = new Test({
		pending: true,
		message: '',
		name: 'Realtime Connection',
		success: undefined
	});

	const create = new Test({
		pending: true,
		message: '',
		name: 'Create',
		success: undefined
	});

	const read = new Test({
		pending: true,
		message: '',
		name: 'Read',
		success: undefined
	});

	const update = new Test({
		pending: true,
		message: '',
		name: 'Update',
		success: undefined
	});

	const del = new Test({
		pending: true,
		message: '',
		name: 'Delete',
		success: undefined
	});

	const recieveCreate = new Test({
		pending: true,
		message: '',
		name: 'Recieve Create',
		success: undefined
	});

	const recieveUpdate = new Test({
		pending: true,
		message: '',
		name: 'Recieve Update',
		success: undefined
	});

	const recieveDelete = new Test({
		pending: true,
		message: '',
		name: 'Recieve Delete',
		success: undefined
	});

	let id: string | undefined;
	const all = struct.all({
		type: 'all'
	});

	let initialized = false;
	struct.on('realtime', (status) => {
		switch (status) {
			case REALTIME_SUBSCRIBE_STATES.SUBSCRIBED:
				realtime.set({
					pending: false,
					message: 'Realtime connection established',
					name: 'Realtime Connection',
					success: true
				});
				break;
			case REALTIME_SUBSCRIBE_STATES.CLOSED:
				realtime.set({
					pending: false,
					message: 'Realtime connection closed',
					name: 'Realtime Connection',
					success: false
				});
				return;
			case REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR:
				realtime.set({
					pending: false,
					message: 'Realtime connection error',
					name: 'Realtime Connection',
					success: false
				});
				return;
			case REALTIME_SUBSCRIBE_STATES.TIMED_OUT:
				realtime.set({
					pending: false,
					message: 'Realtime connection timed out',
					name: 'Realtime Connection',
					success: false
				});
				return;
		}
		if (initialized) return;
		initialized = true;

		all.await().then((res) => {
			if (res.isErr()) {
				read.set({
					pending: false,
					message: res.error.message,
					name: 'Read',
					success: false
				});
			} else {
				read.set({
					pending: false,
					message: 'Read successfully',
					name: 'Read',
					success: true
				});
			}
		});

		struct
			.new({
				name: 'Test',
				age: 1
			})
			.await()
			.then(async (res) => {
				if (res.isErr()) {
					create.set({
						pending: false,
						message: res.error.message,
						name: 'Create',
						success: false
					});
				} else {
					if ('error' in res.value) {
						create.set({
							pending: false,
							message: res.value.error.message,
							name: 'Create',
							success: false
						});
						return;
					}

					create.set({
						pending: false,
						message: 'Created successfully',
						name: 'Create',
						success: true
					});

					if (!res.value.pending && 'result' in res.value) {
						if (!res.value.result.length) {
							update.set({
								pending: false,
								message: 'No results found for update',
								name: 'Update',
								success: false
							});
							return;
						}
						id = String(res.value.result[0].data.id);
						const updateRes = await res.value.result[0]
							.update(() => ({
								age: 2
							}))
							.await();
						if (updateRes.isErr()) {
							update.set({
								pending: false,
								message: updateRes.error.message,
								name: 'Update',
								success: false
							});
						} else {
							if ('error' in updateRes.value) {
								update.set({
									pending: false,
									message: updateRes.value.error.message,
									name: 'Update',
									success: false
								});
								return;
							}
							update.set({
								pending: false,
								message: 'Updated successfully',
								name: 'Update',
								success: true
							});

							await recieveUpdate.await();

							const deleteRes = await res.value.result[0].delete().await();
							if (deleteRes.isErr()) {
								del.set({
									pending: false,
									message: deleteRes.error.message,
									name: 'Delete',
									success: false
								});
							} else {
								if ('error' in deleteRes.value) {
									del.set({
										pending: false,
										message: deleteRes.value.error.message,
										name: 'Delete',
										success: false
									});
									return;
								}
								del.set({
									pending: false,
									message: 'Deleted successfully',
									name: 'Delete',
									success: true
								});
							}
						}
					}
				}
			});

		setTimeout(() => {
			if (read.data.pending) {
				read.set({
					pending: false,
					message: 'Read timed out',
					name: 'Read',
					success: false
				});
			}
			if (recieveCreate.data.pending) {
				recieveCreate.set({
					pending: false,
					message: 'Recieve Create timed out',
					name: 'Recieve Create',
					success: false
				});
			}
			if (recieveUpdate.data.pending) {
				recieveUpdate.set({
					pending: false,
					message: 'Recieve Update timed out',
					name: 'Recieve Update',
					success: false
				});
			}
			if (recieveDelete.data.pending) {
				recieveDelete.set({
					pending: false,
					message: 'Recieve Delete timed out',
					name: 'Recieve Delete',
					success: false
				});
			}
			if (update.data.pending) {
				update.set({
					pending: false,
					message: 'Update timed out',
					name: 'Update',
					success: false
				});
			}
			if (del.data.pending) {
				del.set({
					pending: false,
					message: 'Delete timed out',
					name: 'Delete',
					success: false
				});
			}
			if (create.data.pending) {
				create.set({
					pending: false,
					message: 'Create timed out',
					name: 'Create',
					success: false
				});
			}
		}, 1000 * 10);
	});

	struct.on('new', (data) => {
		if (id && String(data.data.id) === id) {
			recieveCreate.set({
				pending: false,
				message: 'Recieved create successfully',
				name: 'Recieve Create',
				success: true
			});
		}
	});

	struct.on('update', (data) => {
		if (id && String(data.data.id) === id) {
			recieveUpdate.set({
				pending: false,
				message: 'Recieved update successfully',
				name: 'Recieve Update',
				success: true
			});
		}
	});

	struct.on('delete', (data) => {
		if (id && String(data.data.id) === id) {
			recieveDelete.set({
				pending: false,
				message: 'Recieved delete successfully',
				name: 'Recieve Delete',
				success: true
			});
		}
	});

	const arr = new WritableArray([
		realtime,
		create,
		read,
		update,
		del,
		recieveCreate,
		recieveUpdate,
		recieveDelete
	]);

	arr.on(
		'all-unsubscribe',
		all.subscribe(() => {
			// called to initially populate the struct and then called on any changes to the struct
			console.log('All data in struct:', all.data);
		})
	);
	for (const test of arr.data) {
		arr.pipe(test);
	}

	return arr;
};
