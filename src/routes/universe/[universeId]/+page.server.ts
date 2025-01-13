import { Universes } from '$lib/server/structs/universe.js';
import { fail } from '@sveltejs/kit';
import { ServerCode } from 'ts-utils/status';

export const load = async (event) => {
	const { universeId } = event.params;

	const universe = await Universes.Universe.fromId(universeId);
	if (universe.isErr()) {
		console.error(universe.error);
		throw fail(ServerCode.internalServerError);
	}

	return {
		universe: universe.value?.safe()
	};
};
