import { type StatusCode } from 'ts-utils/status';

type StatusConfig = {
	code: StatusCode;
	success: boolean;

	message?: string;
	data?: unknown;

	notification?: {
		title: string;
	};
};

export class Status extends Response {
	constructor(config: StatusConfig) {
		super(
			JSON.stringify({
				success: config.success,
				message: config.message,
				data: config.data,
				notification: config.notification
			}),
			{
				status: config.code,
				headers: {
					'Content-Type': 'application/json'
				}
			}
		);
	}
}
