import { DB } from '$lib/server/db';
import { connectionEmitter, handleEvent } from '$lib/server/event-handler';
import { Test } from '$lib/server/structs/testing';

if (!Test.Test.built) {
	Test.Test.build(DB).then((res) => {
		console.log(res);
		if (res.isErr()) {
			console.error(res.error);
		}
	});
	Test.Test.eventHandler(handleEvent(Test.Test));
	// TODO: make this base on .env?
	Test.Test.bypass('*', () => true);
	connectionEmitter(Test.Test);
}
