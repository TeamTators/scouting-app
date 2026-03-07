import pushRoles from './sb-push-roles';
import pushSchema from './sb-push-schema';

export default async () => {
	const schemaResult = await pushSchema().unwrap();
	const rolesResult = await pushRoles().unwrap();

	return {
		schema: schemaResult,
		roles: rolesResult
	};
};
