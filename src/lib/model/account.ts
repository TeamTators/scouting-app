import { browser } from '$app/environment';
import {
	SupaLinkingStruct,
	SupaStruct,
	SupaStructData,
	type Client,
	type PartialRow,
	type ReadConfig,
	type ReadType,
	type SearchQuery,
	type ReadReturnType,
	SupaStructArray,
} from '$lib/services/supabase/supastruct';
import { WritableArray, WritableBase } from '$lib/services/writables';
import type { Icon } from '$lib/types/icons';
// import { TempMap } from '$lib/utils/temp-map';
import type { Session } from '@supabase/supabase-js';
import { attemptAsync, ResultPromise } from 'ts-utils';

export class Account extends WritableBase<{
	profile: PartialRow<'profile'>;
	user?: Session['user'];
}> {
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

	get id() {
		return String(this.profile.data.id);
	}

	get username() {
		return this.profile.data.username;
	}

	get firstName() {
		return this.profile.data.first_name;
	}

	get lastName() {
		return this.profile.data.last_name;
	}

	isAdmin() {
		return attemptAsync(async () => {
			const admin = await this.factory.admins.fromId(this.id).unwrap();
			return !!admin;
		});
	}

	getRoles() {
		return this.factory.config.roleAccount.getLinkedB(this.profile);
	}

	getNotifications() {
		return this.factory.config.notifications.get(
			{
				account_id: this.id
			},
			{
				type: 'all'
			}
		);
	}
}

export class AccountArr extends WritableArray<Account> {}

class AccountFactory {
	// browser side cache to avoid creating multiple instances of the same account, since the factory is a singleton on the client, this is safe to do
	private readonly cache = new Map<string, Account>();

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

	log(...args: unknown[]) {
		// if (this.config.debug) {
		console.log('[AccountFactory]', ...args);
		// }
	}

	get supabase() {
		return this.config.profile.supabase;
	}

	get profile() {
		return this.config.profile;
	}

	get admins() {
		return this.config.admin;
	}

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

	getAccount(id: string) {
		return attemptAsync(async () => {
			const profile = await this.profile.fromId(id).unwrap();
			if (!profile) throw new Error('No profile found');
			return this.Generator(profile);
		});
	}

	getAccountByUsername(username: string) {
		return attemptAsync(async () => {
			const profile = await this.profile
				.search({
					field: 'username',
					operator: 'eq',
					value: username,
				}, {
					type: 'single',
				})
				.unwrap();
			if (!profile) throw new Error('No profile found');
			return this.Generator(profile);
		});
	}

	getAccountByEmail(email: string) {
		return attemptAsync(async () => {
			const profile = await this.profile
				.search({
					field: 'email',
					operator: 'eq',
					value: email,
				}, {
					type: 'single',
				})
				.unwrap();
			if (!profile) return null;
			return this.Generator(profile);
		});
	}

	getAccounts(...ids: string[]) {
		const accounts = this.profile.fromIds(ids);
		return accounts.map((profile) => this.Generator(profile));
	}

	arr() {
		return new AccountArr([]);
	}

	search(query: SearchQuery<'profile'>, config: ReadConfig<'all'>): SupaStructArray<'profile'>;
	search(query: SearchQuery<'profile'>, config: ReadConfig<'single'>): ResultPromise<SupaStructData<'profile'> | null>;
	search(query: SearchQuery<'profile'>, config: ReadConfig<ReadType>): ReadReturnType<'profile'> {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return this.profile.search(query, config as any).map((profile) => this.Generator(profile)) as any;
	}
}

// browser only instance of the factory, to avoid creating multiple instances in the client
// if we are on the server, this will always be null and a new instance will be created for each request, which is fine since the server is stateless
// const factories = new TempMap<Client, AccountFactory>();
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
