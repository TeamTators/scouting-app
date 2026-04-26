/**
 * @fileoverview Session management and authentication service for handling user sessions.
 * Provides Session class for managing individual session state, and SessionFactory for creating and retrieving sessions.
 * All async operations return typed Results via attemptAsync for consistent error handling.
 */
import { SupaStruct, type Client } from '$lib/services/supabase/supastruct';
import { SupaStructData } from '$lib/services/supabase/supastruct-data';
import { type Provider, type Session as S } from '@supabase/supabase-js';
import { attemptAsync } from 'ts-utils';
import { getAccountFactory } from '$lib/model/account';
import supabase from '../services/supabase';
// import { TempMap } from "$lib/utils/temp-map";
import { domain } from '../utils/env-utils';
import { z } from 'zod';

/**
 * Resolves a user by username or email by querying the profile struct.
 * @async
 * @param {string} usernameOrEmail - Username or email to look up.
 * @returns {ResultPromise<User|null, Error>} User object if found, null if not found, error if lookup fails.
 * @private
 */
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

/**
 * Represents an authenticated user session with associated account and auth state.
 * Wraps Supabase session with application-specific session data from database.
 */
export class Session {
	/**
	 * Creates a Session instance.
	 * @param {Object} config - Session configuration.
	 * @param {S} config.session - Supabase session object containing auth tokens and user data.
	 * @param {SupaStructData<'session'>} config.customSession - Application session record from database.
	 * @param {Client} config.client - Supabase client instance for API calls.
	 * @param {boolean} [config.debug] - Enable debug logging for session operations.
	 */
	constructor(
		public readonly config: {
			session: S;
			customSession: SupaStructData<'session'>;
			client: Client;
			debug?: boolean;
		}
	) {}

	/**
	 * Unique identifier for this session.
	 * @type {string}
	 * @readonly
	 */
	get id() {
		return String(this.config.customSession.data.id);
	}

	/**
	 * Account ID associated with this session.
	 * @type {string}
	 * @readonly
	 */
	get accountId() {
		return this.config.customSession.data.account_id;
	}

	/**
	 * Previous URL the user was on before authentication.
	 * @type {string|null}
	 * @readonly
	 */
	get prevUrl() {
		return this.config.customSession.data.prev_url;
	}

	/**
	 * Logs debug messages if debug mode is enabled.
	 * @param {...unknown[]} args - Values to log.
	 * @private
	 */
	log(...args: unknown[]) {
		if (this.config.debug) {
			console.log('[Session]', ...args);
		}
	}

	/**
	 * Retrieves the Account object associated with this session.
	 * @async
	 * @returns {ResultPromise<Account|null, Error>} Account instance if user authenticated, null otherwise.
	 * @example
	 * const res = await session.getAccount().unwrap();
	 * if (res) {
	 *   console.log('Account ID:', res.id);
	 * }
	 */
	getAccount() {
		return attemptAsync(async () => {
			const accountFactory = getAccountFactory(this.config.client, {
				debug: this.config.debug
			});
			const self = await accountFactory.getSelf().unwrap();
			return self;
		});
	}

	/**
	 * Retrieves the Supabase User object for this session.
	 * @async
	 * @returns {ResultPromise<User, Error>} Authenticated user object.
	 * @example
	 * const res = await session.getUser().unwrap();
	 * console.log('User email:', res.email);
	 */
	getUser() {
		return attemptAsync(async () => {
			const { data, error } = await this.config.client.auth.getUser();
			if (error) throw error;
			return data.user;
		});
	}

	/**
	 * Authenticates a user with email/username and password credentials.
	 * @async
	 * @param {Object} config - Sign-in configuration.
	 * @param {string} config.emailOrUsername - User's email address or username.
	 * @param {string} config.password - User's password.
	 * @returns {ResultPromise<Session, Error>} Authenticated session if successful.
	 * @example
	 * const res = await session.signIn({
	 *   emailOrUsername: 'user@example.com',
	 *   password: 'secure-password'
	 * }).unwrap();
	 */
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

	/**
	 * Initiates one-time password (OTP) authentication flow via email.
	 * @async
	 * @param {Object} config - OTP sign-in configuration.
	 * @param {string} config.emailOrUsername - User's email address or username.
	 * @returns {ResultPromise<OTPResponse, Error>} OTP session data for email verification.
	 * @example
	 * const res = await session.signInOTP({
	 *   emailOrUsername: 'user@example.com'
	 * }).unwrap();
	 */
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

	/**
	 * Initiates OAuth2 authentication with external provider.
	 * @async
	 * @param {Object} config - OAuth configuration.
	 * @param {Provider} config.provider - OAuth provider name (e.g., 'google', 'github').
	 * @returns {ResultPromise<OAuthResponse, Error>} OAuth URL and session data.
	 * @example
	 * const res = await session.signInOAuth2({
	 *   provider: 'google'
	 * }).unwrap();
	 */
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

	/**
	 * Signs out the user and invalidates the current session.
	 * @async
	 * @returns {ResultPromise<void, Error>} Resolves when sign-out completes.
	 * @example
	 * const res = await session.signOut().unwrap();
	 */
	signOut() {
		return attemptAsync(async () => {
			const { error } = await this.config.client.auth.signOut();
			if (error) throw error;
		});
	}
}

/**
 * Factory for creating and retrieving Session instances.
 * Handles session creation, lookup, and associated authentication operations.
 */
class SessionFactory {
	/**
	 * Creates a SessionFactory instance.
	 * @param {Object} config - Factory configuration.
	 * @param {Client} config.client - Supabase client for API operations.
	 * @param {boolean} [config.debug] - Enable debug logging.
	 * @param {SupaStruct<'session'>} config.session - Session struct for database operations.
	 */
	constructor(
		public readonly config: {
			client: Client;
			debug?: boolean;
			session: SupaStruct<'session'>;
		}
	) {}

	/**
	 * Supabase client instance.
	 * @type {Client}
	 * @readonly
	 */
	get session() {
		return this.config.client;
	}

	/**
	 * Logs debug messages if debug mode is enabled.
	 * @param {...unknown[]} args - Values to log.
	 * @private
	 */
	log(...args: unknown[]) {
		if (this.config.debug) {
			console.log('[SessionFactory]', ...args);
		}
	}

	/**
	 * Creates a Session instance from Supabase and custom session data.
	 * @param {S} session - Supabase session object.
	 * @param {SupaStructData<'session'>} customSession - Application session record.
	 * @returns {Session} New Session instance.
	 * @private
	 */
	Generator(session: S, customSession: SupaStructData<'session'>) {
		return new Session({
			session,
			customSession,
			client: this.session,
			debug: this.config.debug
		});
	}

	/**
	 * Retrieves or creates the current authenticated session.
	 * @async
	 * @param {string} [setUrl] - Optional URL to set as previous navigation point.
	 * @returns {ResultPromise<Session|null, Error>} Current session if authenticated, null if not.
	 * @example
	 * const res = await factory.getSelf('/previous-page').unwrap();
	 * if (res) {
	 *   console.log('Session ID:', res.id);
	 * }
	 */
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
					account_id: data.session.user.id,
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

	/**
	 * Retrieves a session by ID from the database.
	 * @param {string} id - Unique session identifier.
	 * @returns {ResultPromise<SupaStructData<'session'>, Error>} Session data from database.
	 */
	fromId(id: string) {
		return this.config.session.fromId(id);
	}
}

// const factories = new TempMap<Client, SessionFactory>();
/**
 * Creates or retrieves a SessionFactory instance for the given Supabase client.
 * Serves as the factory function for session management operations.
 * @param {Client} client - Supabase client instance.
 * @param {Object} [config] - Optional factory configuration.
 * @param {boolean} [config.debug] - Enable debug logging.
 * @returns {SessionFactory} Factory for creating and managing sessions.
 * @example
 * const factory = getSessionFactory(supabase, { debug: true });
 * const session = await factory.getSelf().unwrap();
 */
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
