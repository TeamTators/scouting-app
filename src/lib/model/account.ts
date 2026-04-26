/**
 * @fileoverview Account model and factory for managing user profiles and associated data.
 * Provides Account class for individual user state and AccountFactory for creation, lookup, and caching.
 * Client-side only; maintains in-memory cache to avoid duplicate Account instances.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { browser } from '$app/environment';
import {
	SupaLinkingStruct,
	SupaStruct,
	type Client,
	type PartialRow,
	type ReadConfig,
	type ReadType,
	type SearchQuery,
	type ReadReturnType,
	SupaStructArray
} from '$lib/services/supabase/supastruct';
import { SupaStructData } from '$lib/services/supabase/supastruct-data';
import { WritableArray, WritableBase } from '$lib/services/writables';
// import { TempMap } from '$lib/utils/temp-map';
import type { Session } from '@supabase/supabase-js';
import { attemptAsync, ResultPromise } from 'ts-utils';

/**
 * Represents an authenticated user account with profile data and Supabase user.
 * Extends WritableBase for reactive state management with profile and user properties.
 */
export class Account extends WritableBase<{
	profile: PartialRow<'profile'>;
	user?: Session['user'];
}> {
	/**
	 * Creates an Account instance.
	 * @param {SupaStructData<'profile'>} profile - User profile struct data.
	 * @param {AccountFactory} factory - Parent factory for related struct access.
	 * @param {Session['user']} [user] - Supabase user object if authenticated.
	 */
	constructor(
		public readonly profile: SupaStructData<'profile'>,
		public readonly factory: AccountFactory,
		public readonly user?: Session['user']
	) {
		super({
			profile: profile.data,
			user
		});
	}

	/**
	 * Unique account identifier.
	 * @type {string}
	 * @readonly
	 */
	get id() {
		return String(this.profile.data.id);
	}

	/**
	 * User's username for login and display.
	 * @type {string}
	 * @readonly
	 */
	get username() {
		return this.profile.data.username;
	}

	/**
	 * User's first name.
	 * @type {string}
	 * @readonly
	 */
	get firstName() {
		return this.profile.data.first_name;
	}

	/**
	 * User's last name.
	 * @type {string}
	 * @readonly
	 */
	get lastName() {
		return this.profile.data.last_name;
	}

	/**
	 * Checks if this account has admin privileges.
	 * @async
	 * @returns {ResultPromise<boolean, Error>} True if admin, false otherwise.
	 * @example
	 * const res = await account.isAdmin().unwrap();
	 * if (res) console.log('User is an admin');
	 */
	isAdmin() {
		return attemptAsync(async () => {
			const admin = await this.factory.admins.fromId(this.id).unwrap();
			return !!admin;
		});
	}

	/**
	 * Retrieves roles assigned to this account.
	 * @param {Object} config - Role lookup configuration.
	 * @param {Date} config.expires - Cache expiration timestamp.
	 * @returns {SupaStructArray<'role'>} Array of role structs.
	 */
	getRoles(config: { expires: Date }) {
		return this.factory.config.roleAccount.getLinkedB(this.profile, {
			type: 'all',
			expires: config.expires
		});
	}

	/**
	 * Retrieves notifications sent to this account.
	 * @param {Object} config - Notification lookup configuration.
	 * @param {Date} config.expires - Cache expiration timestamp.
	 * @returns {SupaStructArray<'account_notification'>} Array of notification structs.
	 */
	getNotifications(config: { expires: Date }) {
		return this.factory.config.notifications.get(
			{
				account_id: this.id
			},
			{
				type: 'all',
				expires: config.expires
			}
		);
	}
}

/**
 * Reactive array container for Account instances.
 * Extends WritableArray for subscribable collection management.
 */
export class AccountArr extends WritableArray<Account> {}

/**
 * Factory for creating and retrieving Account instances with client-side caching.
 * Maintains singleton pattern per Supabase client in browser environment.
 */
class AccountFactory {
	// browser side cache to avoid creating multiple instances of the same account, since the factory is a singleton on the client, this is safe to do
	private readonly cache = new Map<string, Account>();

	/**
	 * Creates an AccountFactory instance.
	 * @param {Object} config - Factory configuration.
	 * @param {SupaStruct<'profile'>} config.profile - Profile struct for database access.
	 * @param {SupaStruct<'admin'>} config.admin - Admin struct for privilege checks.
	 * @param {SupaStruct<'role'>} config.role - Role struct for role data.
	 * @param {SupaLinkingStruct} config.roleAccount - Linking struct for role assignments.
	 * @param {SupaStruct<'account_notification'>} config.notifications - Notification struct.
	 * @param {boolean} [config.debug] - Enable debug logging.
	 */
	constructor(
		public readonly config: {
			profile: SupaStruct<'profile'>;
			admin: SupaStruct<'admin'>;
			role: SupaStruct<'role'>;
			roleAccount: SupaLinkingStruct<'role_account', 'profile', 'role'>;
			notifications: SupaStruct<'account_notification'>;
			debug?: boolean;
		}
	) {
		this.log('AccountFactory initialized');
	}

	/**
	 * Logs debug messages.
	 * @param {...unknown[]} args - Values to log.
	 * @private
	 */
	log(...args: unknown[]) {
		// if (this.config.debug) {
		console.log('[AccountFactory]', ...args);
		// }
	}

	/**
	 * Supabase client instance.
	 * @type {SupabaseClient}
	 * @readonly
	 */
	get supabase() {
		return this.config.profile.supabase;
	}

	/**
	 * Profile struct for database access.
	 * @type {SupaStruct<'profile'>}
	 * @readonly
	 */
	get profile() {
		return this.config.profile;
	}

	/**
	 * Admin struct for privilege checks.
	 * @type {SupaStruct<'admin'>}
	 * @readonly
	 */
	get admins() {
		return this.config.admin;
	}

	/**
	 * Retrieves the currently authenticated account.
	 * @async
	 * @returns {ResultPromise<Account|null, Error>} Current account if authenticated, null otherwise.
	 * @example
	 * const res = await factory.getSelf().unwrap();
	 * if (res) {
	 *   console.log('User:', res.username);
	 * }
	 */
	getSelf() {
		return attemptAsync(async () => {
			this.log('Fetching self account');
			const { data, error } = await this.supabase.auth.getUser();
			if (error) throw error;
			const { user } = data;
			this.log('getSelf() user:', user);
			if (!user) return null;
			const profile = await this.profile.fromId(user.id).unwrap();
			this.log('getSelf() profile:', profile);
			if (!profile) return null;
			return new Account(profile, this, user);
		});
	}

	/**
	 * Creates or retrieves cached Account instance from factory cache.
	 * @param {SupaStructData<'profile'>} profile - Profile struct data.
	 * @param {Session['user']} [user] - Supabase user object.
	 * @returns {Account} Account instance (cached if browser and previously created).
	 * @private
	 */
	Generator(profile: SupaStructData<'profile'>, user?: Session['user']) {
		const has = this.cache.get(String(profile.data.id));
		if (has) return has;
		const account = new Account(profile, this, user);
		if (browser) this.cache.set(String(profile.data.id), account);
		account.pipeData(profile, (data) => {
			return {
				profile: data
			};
		});
		return account;
	}

	/**
	 * Retrieves an account by ID.
	 * @async
	 * @param {string} id - Account identifier.
	 * @returns {ResultPromise<Account, Error>} Account instance.
	 * @example
	 * const res = await factory.getAccount('user-id-123').unwrap();
	 */
	getAccount(id: string) {
		return attemptAsync(async () => {
			const profile = await this.profile.fromId(id).unwrap();
			if (!profile) throw new Error('No profile found');
			return this.Generator(profile);
		});
	}

	/**
	 * Retrieves an account by username.
	 * @async
	 * @param {string} username - User's username.
	 * @param {Object} config - Lookup configuration.
	 * @param {Date} config.expires - Cache expiration timestamp.
	 * @returns {ResultPromise<Account, Error>} Account instance.
	 * @example
	 * const res = await factory.getAccountByUsername('john_doe', { expires: futureDate }).unwrap();
	 */
	getAccountByUsername(
		username: string,
		config: {
			expires: Date;
		}
	) {
		return attemptAsync(async () => {
			const profile = await this.profile
				.search(
					{
						field: 'username',
						operator: 'eq',
						value: username
					},
					{
						type: 'single',
						expires: config.expires
					}
				)
				.unwrap();
			if (!profile) throw new Error('No profile found');
			return this.Generator(profile);
		});
	}

	/**
	 * Retrieves an account by email address.
	 * @async
	 * @param {string} email - User's email address.
	 * @param {Object} config - Lookup configuration.
	 * @param {Date} config.expires - Cache expiration timestamp.
	 * @returns {ResultPromise<Account|null, Error>} Account instance or null if not found.
	 * @example
	 * const res = await factory.getAccountByEmail('user@example.com', { expires: futureDate }).unwrap();
	 */
	getAccountByEmail(
		email: string,
		config: {
			expires: Date;
		}
	) {
		return attemptAsync(async () => {
			const profile = await this.profile
				.search(
					{
						field: 'email',
						operator: 'eq',
						value: email
					},
					{
						type: 'single',
						expires: config.expires
					}
				)
				.unwrap();
			if (!profile) return null;
			return this.Generator(profile);
		});
	}

	/**
	 * Retrieves multiple accounts by ID.
	 * @param {...string} ids - Account identifiers.
	 * @returns {Account[]} Array of Account instances.
	 */
	getAccounts(...ids: string[]) {
		const accounts = this.profile.fromIds(ids);
		return accounts.map((profile) => this.Generator(profile));
	}

	/**
	 * Creates an empty AccountArr container.
	 * @returns {AccountArr} Empty reactive account array.
	 */
	arr() {
		return new AccountArr([]);
	}

	/**
	 * Searches for accounts matching a query.
	 * @overload
	 * @param {SearchQuery<'profile'>} query - Search query object.
	 * @param {ReadConfig<'all'>} config - Config requesting all results.
	 * @returns {SupaStructArray<'profile'>} Array of matching account structs.
	 */
	/**
	 * @overload
	 * @param {SearchQuery<'profile'>} query - Search query object.
	 * @param {ReadConfig<'single'>} config - Config requesting single result.
	 * @returns {ResultPromise<SupaStructData<'profile'> | null>} Single result or null.
	 */
	/**
	 * @param {SearchQuery<'profile'>} query - Search query configuration.
	 * @param {ReadConfig<ReadType>} config - Read configuration (all or single).
	 * @returns {SupaStructArray<'profile'>|ResultPromise<SupaStructData<'profile'> | null>} Typed result based on config.
	 * @example
	 * const results = factory.search(
	 *   { field: 'username', operator: 'contains', value: 'john' },
	 *   { type: 'all' }
	 * );
	 */
	search(query: SearchQuery<'profile'>, config: ReadConfig<ReadType>): ReadReturnType<'profile'> {
		return this.profile
			.search(query, config as any)
			.map((profile) => this.Generator(profile)) as any;
	}
}

// browser only instance of the factory, to avoid creating multiple instances in the client
// if we are on the server, this will always be null and a new instance will be created for each request, which is fine since the server is stateless
// const factories = new TempMap<Client, AccountFactory>();
/**
 * Creates or retrieves an AccountFactory instance for the given Supabase client.
 * Ensures singleton factory per client in browser environment.
 * @param {Client} client - Supabase client instance.
 * @param {Object} [config] - Optional factory configuration.
 * @param {boolean} [config.debug] - Enable debug logging.
 * @returns {AccountFactory} Factory for account operations.
 * @example
 * const factory = getAccountFactory(supabase, { debug: true });
 * const account = await factory.getSelf().unwrap();
 */
export const getAccountFactory = (
	client: Client,
	config: {
		debug?: boolean;
	} = {}
) => {
	// const has = factories.get(client);
	// if (has) return has;
	const profile = SupaStruct.get({
		name: 'profile',
		client,
		...config
	});
	const role = SupaStruct.get({
		name: 'role',
		client,
		...config
	});
	const admin = SupaStruct.get({
		name: 'admin',
		client,
		...config
	});
	const roleAccount = SupaLinkingStruct.get('role_account', profile, role, config);
	const notifications = SupaStruct.get({
		name: 'account_notification',
		client,
		...config
	});
	const a = new AccountFactory({
		profile,
		admin,
		role,
		roleAccount,
		notifications,
		...config
	});
	// factories.set(client, a);
	return a;
};
