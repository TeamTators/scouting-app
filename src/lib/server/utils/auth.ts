import { type RequestEvent } from '@sveltejs/kit';

export const auth = async (_event: RequestEvent): Promise<boolean> => true;
