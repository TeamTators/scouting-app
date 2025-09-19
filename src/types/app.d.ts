// See https://svelte.dev/docs/kit/types#app.d.ts

import type { Account } from '$lib/server/structs/account';
import type { Session } from '$lib/server/structs/session';

// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			account?: Account.AccountData | undefined;
			session: Session.SessionData;
<<<<<<< HEAD
			start: number;
=======
			isTrusted: boolean;
>>>>>>> 984257cc6ef87ae0528e26405837ec650c7e5ddc
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
