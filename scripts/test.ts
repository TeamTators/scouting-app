import { sleep } from 'ts-utils';
import supabase from '../src/lib/server/services/supabase';
import { SupaStruct } from '../src/lib/services/supabase/supastruct';

export default async () => {
	const struct = SupaStruct.get({
		client: supabase,
		name: 'test',
		debug: true
	});

	struct.setupListeners();

	await sleep(1000);
};
