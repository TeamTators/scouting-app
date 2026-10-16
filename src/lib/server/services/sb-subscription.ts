/* eslint-disable @typescript-eslint/no-explicit-any */
import { type DatabasePivoted } from '$lib/types/supabase';

type SubscriptionType = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

type Callback<
	Schema extends keyof DatabasePivoted['Row'],
	Table extends keyof DatabasePivoted['Row'][Schema],
	Type extends SubscriptionType
> = (
	payload: Type extends 'INSERT'
		? {
				new: DatabasePivoted['Row'][Schema][Table];
				old: null;
				type: 'INSERT';
			}
		: Type extends 'DELETE'
			? {
					new: null;
					old: DatabasePivoted['Row'][Schema][Table];
					type: 'DELETE';
				}
			: Type extends 'UPDATE'
				? {
						new: DatabasePivoted['Row'][Schema][Table];
						old: DatabasePivoted['Row'][Schema][Table];
						type: 'UPDATE';
					}
				: Type extends '*'
					? | {
								new: DatabasePivoted['Row'][Schema][Table];
								old: DatabasePivoted['Row'][Schema][Table];
								type: 'UPDATE';
						  }
						| {
								new: null;
								old: DatabasePivoted['Row'][Schema][Table];
								type: 'DELETE';
						  }
						| {
								new: DatabasePivoted['Row'][Schema][Table];
								old: null;
								type: 'INSERT';
						  }
					: never
) => void;

export const subscriptions = new Map<string, Array<Callback<any, any, SubscriptionType>>>();

export const subscribe = <
	Schema extends keyof DatabasePivoted['Row'],
	Table extends keyof DatabasePivoted['Row'][Schema],
	Type extends SubscriptionType
>(
	schema: Schema,
	table: Table,
	type: Type,
	callback: Callback<Schema, Table, Type>
) => {
	const do_set = (type: string) => {
		const key = `${schema}.${String(table)}.${type}`;
		if (!subscriptions.has(key)) {
			subscriptions.set(key, []);
		}
		subscriptions.get(key)?.push(callback as Callback<any, any, SubscriptionType>);
	};
	if (type === '*') {
		do_set('INSERT');
		do_set('UPDATE');
		do_set('DELETE');
	} else {
		do_set(type);
	}
};
