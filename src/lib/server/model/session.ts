import { SupaStruct, type Client } from '$lib/services/supabase/supastruct';
import { SupaStructData } from '$lib/services/supabase/supastruct-data';
import { type Provider, type Session as S } from '@supabase/supabase-js';
import { attemptAsync } from 'ts-utils';
import { getAccountFactory } from '$lib/model/account';
import supabase from '../services/supabase';
// import { TempMap } from "$lib/utils/temp-map";
import { domain } from '../utils/env';
import z from 'zod';

const getUser = (usernameOrEmail: string) => {
	return attemptAsync(async () => {
		const factory = getAccountFactory(supabase);
		const profile = await factory.profile
			.getOR(
				{
					username: usernameOrEmail,
					email: usernameOrEmail
				},
				{
					type: 'single'
				}
			)
			.unwrap();
		if (!profile) return null;
		const { data, error } = await supabase.auth.admin.getUserById(String(profile.data.id));
		if (error) throw error;
		return data.user;
	});
};

export class Session {
	constructor(
		public readonly config: {
			session: S;
			customSession: SupaStructData<'session'>;
			client: Client;
			debug?: boolean;
		}
	) {}

	get id() {
		return String(this.config.customSession.data.id);
	}

	get userId() {
		return this.config.customSession.data.user_id;
	}

	get prevUrl() {
		return this.config.customSession.data.prev_url;
	}

	log(...args: unknown[]) {
		if (this.config.debug) {
			console.log('[Session]', ...args);
		}
	}

	getAccount() {
		return attemptAsync(async () => {
			const accountFactory = getAccountFactory(this.config.client, {
				debug: this.config.debug
			});
			const self = await accountFactory.getSelf().unwrap();
			return self;
		});
	}

	getUser() {
		return attemptAsync(async () => {
			const { data, error } = await this.config.client.auth.getUser();
			if (error) throw error;
			return data.user;
		});
	}

	signIn(config: { emailOrUsername: string; password: string }) {
		return attemptAsync(async () => {
			const user = await getUser(config.emailOrUsername).unwrap();
			if (!user) {
				throw new Error('Invalid username/email or password');
			}
			const { data, error } = await supabase.auth.signInWithPassword({
				email: String(user.email),
				password: config.password
			});
			if (error) throw error;
			return data.session;
		});
	}

	signInOTP(config: { emailOrUsername: string }) {
		return attemptAsync(async () => {
			const user = await getUser(config.emailOrUsername).unwrap();
			if (!user) {
				throw new Error('Invalid username/email');
			}
			const { data, error } = await supabase.auth.signInWithOtp({
				email: String(user.email),
				options: {
					emailRedirectTo: domain({
						protocol: true,
						port: false
					})
				}
			});
			if (error) throw error;
			return data;
		});
	}

	signInOAuth2(config: { provider: Provider }) {
		return attemptAsync(async () => {
			const url = domain({
				port: false,
				protocol: true
			});
			const redirectUri = `${url}/api/oauth/sign-in`;
			const { data, error } = await supabase.auth.signInWithOAuth({
				provider: config.provider,
				options: {
					redirectTo: redirectUri
				}
			});
			if (error) throw error;
			return data;
		});
	}

	signOut() {
		return attemptAsync(async () => {
			const { error } = await this.config.client.auth.signOut();
			if (error) throw error;
		});
	}
}

class SessionFactory {
	constructor(
		public readonly config: {
			client: Client;
			debug?: boolean;
			session: SupaStruct<'session'>;
		}
	) {}

	get session() {
		return this.config.client;
	}

	log(...args: unknown[]) {
		if (this.config.debug) {
			console.log('[SessionFactory]', ...args);
		}
	}

	Generator(session: S, customSession: SupaStructData<'session'>) {
		return new Session({
			session,
			customSession,
			client: this.session,
			debug: this.config.debug
		});
	}

	getSelf(setUrl?: string) {
		return attemptAsync(async () => {
			const { data, error } = await this.session.auth.getSession();
			if (error) throw error;
			if (!data.session) return null;
			const accessToken = data.session.access_token;
			const payload = z
				.object({
					session_id: z.string()
				})
				.parse(JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString()));

			const sessionId = payload.session_id;
			let session: SupaStructData<'session'>;
			const res = await this.config.session
				.upsert({
					id: sessionId,
					user_id: data.session.user.id,
					prev_url: setUrl
				})
				.await()
				.unwrap();
			if ('error' in res) {
				throw res.error;
			} else if ('result' in res) {
				session = res.result[0];
			} else {
				throw new Error('Unexpected response from session upsert');
			}

			if (!session) {
				throw new Error('Failed to create or retrieve session');
			}

			return this.Generator(data.session, session);
		});
	}

	fromId(id: string) {
		return this.config.session.fromId(id);
	}
}

// const factories = new TempMap<Client, SessionFactory>();
export const getSessionFactory = (
	client: Client,
	config?: {
		debug?: boolean;
	}
) => {
	// const existing = factories.get(client);
	// if (existing) {
	//     return existing;
	// }
	const factory = new SessionFactory({
		client,
		session: SupaStruct.get({
			name: 'session',
			client: supabase,
			...config
		})
	});
	// factories.set(client, factory);
	return factory;
};
