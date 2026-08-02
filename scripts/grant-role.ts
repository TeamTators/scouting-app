import { SupaStruct } from '../src/lib/services/supabase/supastruct.svelte';
import supabase from '../src/lib/server/services/supabase';
import { grantRole } from '../src/lib/server/utils/auth';

export default async (...args: string[]) => {
	let [id] = args;

	const [, role_name] = args;

	if (!id) throw new Error('User ID is required (grant-role <user_id> <role_name>)');
	if (!role_name) throw new Error('Role is required (grant-role <user_id> <role_name>)');

	const is_uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

	const Profile = SupaStruct.get({
		client: supabase,
		schema: 'core',
		table: 'profile',
	});

	const user = await Profile.get({ username: id }).first().unwrap();
	if (!is_uuid && !user) throw new Error(`User not found: ${id}`);

	if (user) {
		id = user.raw.id;
	}

	const { data, error } = await supabase.auth.admin.getUserById(id);

	if (error) throw new Error(`Failed to fetch user: ${error.message}`);
	if (!data.user) throw new Error('User not found');

	const RoleStruct = SupaStruct.get({
		client: supabase,
		table: 'role',
		schema: 'core'
	});

	const [role] = await RoleStruct.get({ name: role_name }).unwrap();

	if (!role) throw new Error(`Role not found: ${role_name}`);

	await grantRole(supabase, data.user, role);
};
