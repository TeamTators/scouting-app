import { type Client, SupaStruct, SupaStructData } from '$lib/services/supabase/supastruct.svelte';
import { attemptAsync } from 'ts-utils';
import supabase from '$lib/server/services/supabase';

export const hasRole = (client: Client, role: SupaStructData<'core', 'role'>) => {
    return attemptAsync(async () => {
        const RoleAccountStruct = SupaStruct.get({
            client: supabase,
            table: 'role_account',
            schema: 'core',
        });

        const { data: userData, error } = await supabase.auth.getUser();

        if (error || !userData.user) {
            throw new Error('Not authenticated');
        }

        const res = await RoleAccountStruct.get({ account: userData.user.id, role: role.id }).unwrap();

        return res.length > 0;
    });
};