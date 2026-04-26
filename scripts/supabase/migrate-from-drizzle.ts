import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { text } from 'drizzle-orm/pg-core';
import { Struct } from 'drizzle-struct';
import supabase from '../../src/lib/server/services/supabase';
import { domain } from '../../src/lib/server/utils/env-utils';

export default async (...args: string[]) => {
	let host = 'localhost',
		port = '5432',
		database = 'postgres',
		user = 'postgres',
		password = 'postgres';

	let currentArg: string | undefined;
	for (const arg of args) {
		if (currentArg) {
			switch (currentArg) {
				case '--host':
					host = arg;
					break;
				case '--port':
					port = arg;
					break;
				case '--database':
					database = arg;
					break;
				case '--user':
					user = arg;
					break;
				case '--password':
					password = arg;
					break;
			}
			currentArg = undefined;
			continue;
		}
		if (arg.startsWith('--')) {
			currentArg = arg;
		}
	}

	console.log(
		`Connecting to Postgres at ${host}:${port} with database ${database} and user ${user}`
	);

	const DB = drizzle(
		postgres({
			host,
			port: parseInt(port),
			database,
			user,
			password
		})
	);

	const ACCOUNTS = new Struct({
		name: 'account',
		structure: {
			username: text('username').notNull().unique(),
			firstName: text('first_name').notNull(),
			lastName: text('last_name').notNull(),
			email: text('email').notNull().unique()
		}
	});

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	await Struct.buildAll(DB as any);

	const accounts = await ACCOUNTS.all({ type: 'all' }).unwrap();
	console.log('Accounts:', accounts);

	// const userPassword = crypto.randomUUID();

	for (const account of accounts) {
		const { data, error } = await supabase.auth.admin.inviteUserByEmail(account.data.email, {
			redirectTo: domain({
				port: false,
				protocol: true
			})
		});

		if (error) {
			console.error(`Error inviting user ${account.data.email}:`, error);
		} else {
			console.log(data);
			console.log(`Invited user ${account.data.email} with invite link:`);
		}
	}
};
