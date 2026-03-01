/* eslint-disable @typescript-eslint/no-explicit-any */
import supabase from "$lib/services/supabase";
import { type Database } from "$lib/types/supabase";
import { attempt, attemptAsync, type Result } from "ts-utils";
import { WritableArray, WritableBase } from "./writables";
import { type SchemaName, schemaName } from '$lib/types/supabase-schema';
import type { RealtimeChannel } from "@supabase/supabase-js";
import { schemas } from "$lib/types/supabase-zod";

type Table<Name extends keyof Database[SchemaName]['Tables']> = Database[SchemaName]['Tables'][Name];
type Names = keyof Database[SchemaName]['Tables'];
type Row<Name extends Names> = Table<Name>['Row'];
type Insert<Name extends Names> = Table<Name>['Insert'];
type Update<Name extends Names> = Table<Name>['Update'];

export class SupaStatus<T> extends WritableBase<{
    pending: boolean;
    error?: Error;
    result?: T;
}> {
    constructor() {
        super({
            pending: true,
        })
    }
}

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
        const schema = schemas[this.name];
        if (!schema) {
            throw new Error(`No schema found for table ${this.name}`);
        }
        const parseResult = schema.Row.safeParse(row);
        if (!parseResult.success) {
            throw new Error(`Failed to parse row for table ${this.name}: ` + parseResult.error.message);
        }
        return new SupaStructData(this, parseResult.data);
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
            arr.set(data.map(item => this.Generator(item)));
        });
        this.registerArray(arr, () => true);
        return arr;
    }

    new(...data: Insert<Name>[]) {
        const status = new SupaStatus<Row<Name>[]>();
        supabase.from(this.name).insert(data as any).select('*').then(res => {
            const transactionResult = this.runTransaction({
                data: res.data as any,
                error: res.error,
            }, 'array');
            if (transactionResult.isErr()) {
                status.set({
                    pending: false,
                    error: new Error(`Failed to insert row into table ${this.name}: ` + transactionResult.error.message)
                });
            } else {
                status.set({
                    pending: false,
                    result: transactionResult.value,
                });
            }
        });
        return status;
    }

    fromId(id: Row<Name>['id']) {
        return attemptAsync(async () => {
            const res = await supabase.from(this.name).select('*').eq('id', id as any).single();
            const transactionResult = this.runTransaction({
                data: res.data as any,
                error: res.error,
            }, 'single');
            if (transactionResult.isErr()) {
                throw new Error(`Failed to fetch row with id ${id} from table ${this.name}: ` + transactionResult.error.message);
            }
            return this.Generator(transactionResult.value);
        });
    }
}

export class SupaStructArray<Name extends Names> extends WritableArray<SupaStructData<Name>> {}

export class SupaStructData<Name extends Names> extends WritableBase<Row<Name>> {
    constructor(public readonly struct: SupaStruct<Name>, data: Row<Name>) {
        super(data);
    }

    update(fn: (data: Row<Name>) => Update<Name>) {
        const status = new SupaStatus<Row<Name>>();
        try {
            const updateData = fn(this.data);
            supabase.from(this.struct.name).update(updateData as any).eq('id', this.data.id as any).select('*').then(res => {
                const transactionResult = this.struct.runTransaction({
                    data: res.data ? res.data[0] : null as any,
                    error: res.error,
                }, 'single');
                if (transactionResult.isErr()) {
                    status.set({
                        pending: false,
                        error: new Error(`Failed to update row in table ${this.struct.name}: ` + transactionResult.error.message)
                    });
                } else {
                    status.set({
                        pending: false,
                        result: transactionResult.value,
                    });
                }
            });
        } catch (error) {
            status.set({
                pending: false,
                error: error instanceof Error ? error : new Error(String(error)),
            });
        }
        return status;
    }

    delete() {
        const status = new SupaStatus<null>();
        supabase.from(this.struct.name).delete().eq('id', this.data.id as any).then(res => {
            const transactionResult = this.struct.runTransaction({
                data: null,
                error: res.error,
            }, 'null');
            if (transactionResult.isErr()) {
                status.set({
                    pending: false,
                    error: new Error(`Failed to delete row in table ${this.struct.name}: ` + transactionResult.error.message)
                });
            } else {
                status.set({
                    pending: false,
                    result: null,
                });
            }
        });
        return status;
    }
}
