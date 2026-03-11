import { Requests } from '$lib/server/structs/requests.js';
import { auth } from '$lib/server/utils/auth.js';
import { config } from '$lib/server/utils/env.js';
import terminal from '$lib/server/utils/terminal.js';
import { json } from '@sveltejs/kit';
import type { Assignment } from 'tatorscout/scout-groups';
import { teamsFromMatch } from 'tatorscout/tba';

export const GET = async (event) => {
	if (!(await auth(event))) {
		return new Response('Unauthorized', { status: 401 });
	}

	if (!config.app_config.do_scout_groups) {
		const tbaEvent = await Requests.getEvent(event.params.eventKey);
		if (tbaEvent.isErr()) {
			terminal.error(tbaEvent.error);
			return new Response('Error', { status: 500 });
		}

		const assignment: Assignment = {
			matchAssignments: [
				tbaEvent.value.matches.map((m) => teamsFromMatch(m)[0]),
				tbaEvent.value.matches.map((m) => teamsFromMatch(m)[1]),
				tbaEvent.value.matches.map((m) => teamsFromMatch(m)[2]),
				tbaEvent.value.matches.map((m) => teamsFromMatch(m)[3]),
				tbaEvent.value.matches.map((m) => teamsFromMatch(m)[4]),
				tbaEvent.value.matches.map((m) => teamsFromMatch(m)[5])
			],
			groups: tbaEvent.value.matches.map((m) => teamsFromMatch(m)),
			interferences: 0
		};

		return json(assignment);
	}

	const groups = await Requests.getScoutGroups(event.params.eventKey);
	if (groups.isErr()) {
		terminal.error(groups.error);
		return new Response('Error', { status: 500 });
	}

	return new Response(JSON.stringify(groups.value), { status: 200 });
};
