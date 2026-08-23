import { send_email } from '../src/lib/server/services/email';

export default async (email: string) => {
	return await send_email({
		from: 'test',
		to: email,
		subject: 'Test Email',
		type: 'newsletter',
		data: {
			first_name: 'John',
			last_name: 'Doe'
		}
	});
};
