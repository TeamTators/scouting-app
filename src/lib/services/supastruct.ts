import supabase from "$lib/services/supabase";
import { type Database } from "$lib/types/supabase";
import { attempt, type Result } from "ts-utils";
import { WritableArray, WritableBase } from "./writables";
import { type SchemaName, schemaName } from '$lib/types/supabase-schema';
import type { RealtimeChannel } from "@supabase/supabase-js";

type Table<Name extends keyof Database[SchemaName]['Tables']> = Database[SchemaName]['Tables'][Name];
type Names = keyof Database[SchemaName]['Tables'];
type Row<Name extends Names> = Table<Name>['Row'];
type Insert<Name extends Names> = Table<Name>['Insert'];
type Update<Name extends Names> = Table<Name>['Update'];

// type ReadConfig<Name extends Names> = {
//     paginated: true;
//     page: number;
//     limit: number;
// } | {
//     paginated?: false;
// };

export class SupaStruct<Name extends Names> {
    private readonly channel: RealtimeChannel;

    constructor(public readonly name: Name) {
        this.channel = supabase.channel(`struct-${name}`);
    }

    runTransaction(transaction: {
        data: Row<Name>[] | Row<Name> | null;
        error: Error | null;
    }, expect: 'array'): Result<Row<Name>[]>;
    runTransaction(transaction: {
        data: Row<Name>[] | Row<Name> | null;
        error: Error | null;
    }, expect: 'single'): Result<Row<Name>>;
    runTransaction(transaction: {
        data: Row<Name>[] | Row<Name> | null;
        error: Error | null;
    }, expect: 'null'): Result<null>;
    runTransaction(transaction: {
        data: Row<Name>[] | Row<Name> | null;
        error: Error | null;
    }, expect: 'array' | 'single' | 'null'): Result<Row<Name>[] | Row<Name> | null> {
        return attempt(() => {
            if (transaction.error) {
                throw transaction.error;
            }
            if (expect === 'array') {
                if (!Array.isArray(transaction.data)) {
                    throw new Error(`Expected an array but got ${typeof transaction.data}`);
                }
                return transaction.data;
            } else if (expect === 'single') {
                if (Array.isArray(transaction.data)) {
                    throw new Error(`Expected a single object but got an array`);
                }
                if (transaction.data === null) {
                    throw new Error(`Expected a single object but got null`);
                }
                return transaction.data;
            } else { // expect === 'null'
                if (transaction.data !== null) {
                    throw new Error(`Expected null but got ${typeof transaction.data}`);
                }
                return null;
            }
        });
    }

    private readonly registeredArrays = new Map<string, SupaStructArray<Name>>();

    registerArray(array: SupaStructArray<Name>, satisfies: (data: Row<Name>) => boolean) {
        this.registeredArrays.set('all', array);
        this.channel.on('postgres_changes', {
            event: 'INSERT',
            schema: schemaName,
            table: this.name
        }, payload => {
            if (satisfies(payload.new as Row<Name>)) {
                array.data.push(this.Generator(payload.new));
            }
        });
        this.channel.on('postgres_changes', {
            event: 'UPDATE',
            schema: schemaName,
            table: this.name
        }, payload => {
            const index = array.data.findIndex(item => item.data.id === payload.new.id);
            if (index !== -1) {
                if (satisfies(payload.new as Row<Name>)) {
                    array.data[index] = this.Generator(payload.new) ;
                    array.inform();
                } else {
                    array.remove(array.data[index]);
                }
            } else {
                if (satisfies(payload.new as Row<Name>)) {
                    array.data.push(this.Generator(payload.new));
                }
            }
        });
        this.channel.on('postgres_changes', {
            event: 'DELETE',
            schema: schemaName,
            table: this.name
        }, payload => {
            const exists = array.data.find(item => item.data.id === payload.old.id);
            if (exists) array.remove(exists);
        });
    }

    Generator(row: unknown) {
        return new SupaStructData(this, row);
    }

    all() {
        const has = this.registeredArrays.get('all');
        if (has) return has;

        const get = async () => {
            const res = this.runTransaction(await supabase.from(this.name).select('*'), 'array');
            if (res.isErr()) {
                console.error(`Error fetching all from ${this.name}:`, res.error);
                return [];
            }
            return res.value;
        };
        const arr = new SupaStructArray<Name>([])
        get().then(data => {
            arr.set(data);
        });
        this.registerArray(arr, () => true);
        return arr;
    }
}

export class SupaStructArray<Name extends Names> extends WritableArray<SupaStructData<Name>> {}

export class SupaStructData<Name extends Names> extends WritableBase<Row<Name>> {
    constructor(public readonly struct: SupaStruct<Name>, data: Row<Name>) {
        super(data);
    }


}
