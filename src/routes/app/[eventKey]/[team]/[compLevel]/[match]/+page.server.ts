import { Requests } from '$lib/server/structs/requests.js';

export const load = async (event) => {
    const { eventKey, team, compLevel, match } = event.params;

    const eventData = await Requests.getEvent(eventKey);
    if (eventData.isOk()) {
        const m = eventData.value.matches.find(m => m.comp_level === compLevel && m.match_number === parseInt(match));
        const t = eventData.value.teams.find(t => t.team_number === parseInt(team));
        if (m && t) {
            const redFound = m.alliances.red.team_keys.find(k => k === `frc${team}`);
            const blueFound = m.alliances.blue.team_keys.find(k => k === `frc${team}`);
            return {
                event: eventData.value,
                match: m,
                team: t,
                alliance: redFound ? 'red' : blueFound ? 'blue' : null,
                exists: !!redFound || !!blueFound,
            }
        }

        return {
            event: eventData.value,
            match: null,
            team: null,
            alliance: null,
            exists: false,
        }
    }

    return {
        event: null,
        match: null,
        team: null,
        alliance: null,
        exists: false,
    }
}