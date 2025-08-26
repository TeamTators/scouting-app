import { sse } from './sse';
import { attemptAsync } from 'ts-utils/check';
import { z } from 'zod';
import redis from './redis';

export namespace TimeService {
	let time = Date.now();
	let lastSynced = performance.now();
	let initialized = false;

	export const init = async () => {
		return attemptAsync(async () => {
			if (initialized) return;
			initialized = true;

			const service = redis.createListener(process.env.NTP_REDIS_NAME || 'ntp_server_name', {
				time: z.object({
					time: z.number(),
					date: z.number()
				})
			});

			service.on('time', (data) => {
				lastSynced = performance.now();
				time = data.data.time;
				sse.send('time', data.data);
			});

			sse.on('connect', (client) => {
				client.send('time', {
					time,
					date: Date.now()
				});
			});
		});
	};

	export const getTime = () => {
		const now = performance.now();
		const diff = now - lastSynced;
		return time + diff;
	};

	export const getLastSynced = () => {
		return lastSynced;
	};
}
