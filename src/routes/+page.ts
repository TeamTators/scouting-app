import { redirect } from '@sveltejs/kit';
import { ServerCode } from 'ts-utils/status';

export const load = () => {
	throw redirect(ServerCode.permanentRedirect, '/app');
};
