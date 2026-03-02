import { browser } from '$app/environment';
import {
	SupaLinkingStruct,
	SupaStruct,
	SupaStructData,
	type Client,
	type PartialRow,
	type SearchQuery
} from '$lib/services/supabase/supastruct';
import { WritableArray, WritableBase } from '$lib/services/writables';
import type { Session } from '@supabase/supabase-js';
import { attemptAsync } from 'ts-utils';

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
		return this.factory.config.notifications.get({
			account_id: this.id
		});
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
		}
	) {}

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
			const { data, error } = await this.supabase.auth.getUser();
			if (error) throw error;
			const { user } = data;
			if (!user) throw new Error('No user found');
			const profile = await this.profile.fromId(user.id).unwrap();
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

	getAccounts(...ids: string[]) {
		const accounts = this.profile.fromIds(ids);
		return accounts.map((profile) => this.Generator(profile));
	}

	arr() {
		return new AccountArr([]);
	}

	search(query: SearchQuery<'profile'>) {
		return this.profile.search(query).map((profile) => this.Generator(profile));
	}
}

// browser only instance of the factory, to avoid creating multiple instances in the client
// if we are on the server, this will always be null and a new instance will be created for each request, which is fine since the server is stateless
let AccountFactoryInstance: AccountFactory | null = null;
export const getAccountFactory = (client: Client) => {
	if (AccountFactoryInstance && browser) return AccountFactoryInstance;
	const profile = SupaStruct.get({
		name: 'profile',
		client
	});
	const role = SupaStruct.get({
		name: 'role',
		client
	});
	const admin = SupaStruct.get({
		name: 'admin',
		client
	});
	const roleAccount = SupaLinkingStruct.get('role_account', profile, role);
	const notifications = SupaStruct.get({
		name: 'account_notification',
		client
	});
	const a = new AccountFactory({
		profile,
		admin,
		role,
		roleAccount,
		notifications
	});
	if (browser) AccountFactoryInstance = a;
	return a;
};
