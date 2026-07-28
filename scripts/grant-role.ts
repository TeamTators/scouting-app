import { SupaStruct } from '../src/lib/services/supabase/supastruct.svelte';
import supabase from '../src/lib/server/services/supabase';
import { grantRole } from '../src/lib/server/utils/auth';

export default async (...args: string[]) => {
	const [id, roleName] = args;

	if (!id) throw new Error('User ID is required (grant-role <user_id> <role_name>)');
	if (!roleName) throw new Error('Role is required (grant-role <user_id> <role_name>)');

	const { data, error } = await supabase.auth.admin.getUserById(id);

	if (error) throw new Error(`Failed to fetch user: ${error.message}`);

	if (!data.user) throw new Error('User not found');

	const RoleStruct = SupaStruct.get({
		client: supabase,
		table: 'role',
		schema: 'core'
	});

	const [role] = await RoleStruct.get({ name: roleName }).unwrap();

	if (!role) throw new Error(`Role not found: ${roleName}`);

	await grantRole(supabase, data.user, role);
};
