import init from './sb-init';
import dumpRoles from './sb-dump-roles';
import dumpSchema from './sb-dump-schema';

export default async () => {
	await init();
	await dumpRoles();
	await dumpSchema();
};
