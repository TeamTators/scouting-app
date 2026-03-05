import init from './sb-init';
import gen from './sb-gen';
import dumpRoles from './sb-dump-roles';
import dumpSchema from './sb-dump-schema';

export default async () => {
	await init();
	await gen();
	await dumpRoles();
	await dumpSchema();
};
