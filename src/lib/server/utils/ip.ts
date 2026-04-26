import { attemptAsync } from 'ts-utils';
import {z} from 'zod';

export const getPublicIp = () => {
	return attemptAsync(async () => {
		const res = await fetch('https://api.ipify.org?format=json');
		const data = z.object({ ip: z.string() }).parse(await res.json());
		return data.ip;
	});
};
