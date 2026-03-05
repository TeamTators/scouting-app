import supabase from '../src/lib/server/services/supabase';
import { getAccountFactory } from '../src/lib/model/account';

export default async () => {
	// const { data, error } = await supabase.from('profile').select('*');
	const factory = getAccountFactory(supabase, { debug: true });

	// const { data, error } = await supabase.rpc('version');
	// console.log(data, error);

	const res = await factory.profile
		.new({
			id: '6bf2cd84-ad3b-411f-b76f-778ef20427c4',
			username: 'tsaxking',
			first_name: 'Taylor',
			last_name: 'King'
		})
		.await()
		.unwrap();
	console.log(res);
};
