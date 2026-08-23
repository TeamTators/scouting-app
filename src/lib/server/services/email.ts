import { attemptAsync } from 'ts-utils';
import env from '$lib/server/utils/env';
import { emails, type Emails } from '$lib/emails';

export const send_email = <T extends keyof Emails>(config: {
	from: string;
	to: string;
	subject: string;
	type: T;
	data: Parameters<Emails[T]>[0];
}) => {
	return attemptAsync(async () => {
		const [html] = await emails[config.type](config.data);
		const res = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${env.RESEND_API_KEY}`
			},
			body: JSON.stringify({
				from: `${config.from}.${env.RESEND_NAME}@resend.dev`,
				to: config.to,
				subject: env.APP_NAME + ': ' + config.subject,
				html
			})
		});

		const result = await res.json();
		return result;
	});
};
