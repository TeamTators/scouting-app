import pushRoles from './sb-push-roles';
import pushSchema from './sb-push-schema';

export default async () => {
	await pushSchema();
	await pushRoles();
};
