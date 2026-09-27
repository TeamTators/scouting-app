/**
 * @fileoverview Server-side email dispatch helper for the app's typed email templates.
 *
 * This service sends generated HTML email payloads through the Resend API using the
 * project’s branded email metadata and typed template definitions.
 *
 * @example
 * import { send_email } from '$lib/server/services/email';
 *
 * await send_email({
 *   from: 'support',
 *   to: 'hello@example.com',
 *   subject: 'Welcome',
 *   type: 'welcome',
 *   data: { name: 'Ava' }
 * }).unwrap();
 */
import { attemptAsync } from 'ts-utils';
import env from '$lib/server/utils/env';
import { emails, type Emails } from '$lib/emails';

/**
 * Sends a typed email message using the configured Resend API credentials.
 *
 * @template T - Email template key defined by the app's typed email registry.
 * @param {{ from: string; to: string; subject: string; type: T; data: Parameters<Emails[T]>[0] }} config - Email delivery configuration.
 * @returns {ReturnType<typeof attemptAsync>} Result-wrapped response payload from Resend.
 */
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
