import { type Client, SupaStruct, SupaStructData } from '$lib/services/supabase/supastruct.svelte';
import { attemptAsync } from 'ts-utils';
import supabase from '$lib/server/services/supabase';
import { type User } from '@supabase/supabase-js';

export const hasRole = (client: Client, role: SupaStructData<'core', 'role'> | string) => {
	return attemptAsync(async () => {
		if (typeof role === 'string') {
			const RoleStruct = SupaStruct.get({
				client: supabase,
				schema: 'core',
				table: 'role',
			});

			const res = await RoleStruct.get({ name: role }).first().unwrap();

			role = res;
			if (!role) return false;
		}

		const RoleAccountStruct = SupaStruct.get({
			client: supabase,
			table: 'role_account',
			schema: 'core'
		});

		const { data: userData, error } = await client.auth.getUser();

		if (error || !userData.user) {
			throw new Error('Not authenticated');
		}

		const res = await RoleAccountStruct.get({ account: userData.user.id, role: role.id }).unwrap();

		return res.length > 0;
	});
};

export const grantRole = (
	granter: Client,
	grantee: User,
	role: SupaStructData<'core', 'role', 'id'>
) => {
	return attemptAsync(async () => {
		const RoleAccountStruct = SupaStruct.get({
			client: granter,
			table: 'role_account',
			schema: 'core'
		});

		return RoleAccountStruct.new({
			account: grantee.id,
			role: role.id
		}).unwrap();
	});
};
