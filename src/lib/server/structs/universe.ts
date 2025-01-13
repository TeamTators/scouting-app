import { boolean, text } from 'drizzle-orm/pg-core';
import { Struct } from 'drizzle-struct/back-end';
import { attemptAsync, resolveAll } from 'ts-utils/check';
import { Account } from './account';
import { DB } from '../db';
import { eq, sql } from 'drizzle-orm';
import { Permissions } from './permissions';

export namespace Universes {
	export const Universe = new Struct({
		name: 'universe',
		structure: {
			name: text('name').notNull(),
			description: text('description').notNull(),
			public: boolean('public').notNull()
		}
	});

	Universe.on('delete', (u) => {
		Struct.each((s) => {
			s.each((d) => {
				d.removeUniverses(u.id);
			});

			UniverseInvites.fromProperty('universe', u.id, {
				type: 'stream'
			}).pipe((i) => i.delete());
		});
	});

	export type UniverseData = typeof Universe.sample;

	export const getUniverses = async (account: Account.AccountData) => {
		return attemptAsync(async () => {
			return resolveAll(
				await Promise.all(
					account
						.getUniverses()
						.unwrap()
						.map((u) => Universes.Universe.fromId(u))
				)
			)
				.unwrap()
				.filter(Boolean) as Universes.UniverseData[];
		});
	};

	export const UniverseInvites = new Struct({
		name: 'universe_invite',
		structure: {
			universe: text('universe').notNull(),
			account: text('account').notNull(),
			inviter: text('inviter').notNull()
		}
	});

	export type UniverseInviteData = typeof UniverseInvites.sample;

	export const createUniverse = async (
		config: {
			name: string;
			description: string;
			public: boolean;
		},
		account: Account.AccountData
	) => {
		attemptAsync(async () => {
			const u = (await Universe.new(config)).unwrap();
			const admin = (
				await Permissions.Role.new({
					universe: u.id,
					name: 'Admin',
					permissions: '[*]',
					description: `${u.data.name} Aministrator`
				})
			).unwrap();
			const member = (
				await Permissions.Role.new({
					universe: u.id,
					name: 'Member',
					permissions: '[]',
					description: `${u.data.name} Member`
				})
			).unwrap();
			(await account.addUniverses(u.id)).unwrap();
			await Permissions.RoleAccount.new({
				role: admin.id,
				account: account.id
			});
			(
				await Permissions.RoleAccount.new({
					role: member.id,
					account: account.id
				})
			).unwrap();
		});
	};

	export const invite = async (
		universe: Universes.UniverseData,
		account: Account.AccountData,
		inviter: Account.AccountData
	) => {
		return attemptAsync(async () => {
			const invite = (
				await UniverseInvites.new({
					universe: universe.id,
					account: account.id,
					inviter: inviter.id
				})
			).unwrap();

			(
				await Account.sendAccountNotif(account, {
					title: 'Universe Invite',
					message: `You have been invited to join ${universe.data.name} by ${inviter.data.username}`,
					severity: 'info',
					icon: '/assets/icons/invite.svg',
					link: `/universe/invite/${invite.id}`
				})
			).unwrap();

			return invite;
		});
	};

	export const getInvites = async (
		account: Account.AccountData,
		config: {
			type: 'array';
			limit: number;
			offset: number;
		}
	) => {
		return attemptAsync(async () => {
			const res = await DB.select()
				.from(UniverseInvites.table)
				.innerJoin(Universe.table, eq(UniverseInvites.table.universe, Universe.table.id))
				.limit(config.limit)
				.offset(config.offset)
				.where(sql`${UniverseInvites.table.account} = ${account.id}`);

			return res.map((r) => ({
				invite: UniverseInvites.Generator(r.universe_invite),
				universe: Universe.Generator(r.universe)
			}));
		});
	};

	export const acceptInvite = async (invite: UniverseInviteData) => {
		return attemptAsync(async () => {
			const { account, universe } = invite.data;

			const a = await (await Account.Account.fromId(account)).unwrap();
			if (!a) return;
			(await a.addUniverses(universe)).unwrap();

			(await invite.delete()).unwrap();
		});
	};

	export const declineInvite = async (invite: UniverseInviteData) => {
		return invite.delete();
	};
}

export const _universeTable = Universes.Universe.table;
export const _universeInviteTable = Universes.UniverseInvites.table;
