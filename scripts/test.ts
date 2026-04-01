import { SupaStruct, SupaStructData } from '../src/lib/services/supabase/supastruct';
import supabase from '../src/lib/services/supabase';

const describe = async (description: string, fn: () => void) => {
    console.log(description);
    await fn();
}

const it = async (description: string, fn: () => Promise<void>) => {
    try {
        await fn();
        console.log(`  ✓ ${description}`);
    } catch (error) {
        console.error(`  ✗ ${description}`);
        console.error(error);
    }
}

const expect = (value: unknown) => {
    return {
        toEqual: (expected: unknown) => {
            if (value !== expected) {
                throw new Error(`Expected ${value} to equal ${expected}`);
            }
        },
        toBe: (expected: unknown) => {
            if (value !== expected) {
                throw new Error(`Expected ${value} to be ${expected}`);
            }
        },
        toBeDefined: () => {
            if (value === undefined) {
                throw new Error(`Expected value to be defined, but it was undefined`);
            }
        }, 
    }
}

export default async () => {
    await describe('Realtime Tests', async () => {
    const struct = SupaStruct.get({
        client: supabase,
        name: 'test',
        debug: true,
    });

    struct.setupListeners();



    await it('Should run the create-update-delete flow', async () => {
        const createPromise = new Promise<SupaStructData<'test'>>((res) => { struct.on('new', data => {
            console.log('received new data');
            res(data);
        });});
        const updatePromise = new Promise<SupaStructData<'test'>>((res) => { struct.on('update', data => {
            console.log('received updated data');
            res(data);
        });});
        const deletePromise = new Promise<SupaStructData<'test'>>((res) => { struct.on('delete', data => {
            console.log('received deleted data');
            res(data);
        });});

        const age =  Math.round(Math.random() * 100);
        const created = await struct.new({
            name: 'Realtime Test',
            age,
        }).await().unwrap();
        if (created.pending) throw new Error('Creation is pending');
        if ('error' in created) throw new Error('Creation failed: ' + created.error.message);
        
        const [data] = created.result;
        expect(data).toBeDefined();
        if (!data) throw new Error('Data is not defined'); // should never happen but for type safety
        expect(data.data.name).toBe('Realtime Test');
        expect(data.data.age).toBe(age);
        const id = data.id || '';

        const updated = await data.update((data) => ({
            ...data,
            age: age + 1,
        })).await().unwrap();
        if (updated.pending) throw new Error('Update is pending');
        if ('error' in updated) throw new Error('Update failed: ' + updated.error.message);

        const deleted = await data.delete().await().unwrap();
        if (deleted.pending) throw new Error('Delete is pending');
        if ('error' in deleted) throw new Error('Delete failed: ' + deleted.error.message);

        const createdData = await createPromise;
        console.log('Received created data:', createdData);
        expect(createdData).toBeDefined();
        expect(createdData.data.name).toBe('Realtime Test');
        expect(createdData.data.age).toBe(age);
        expect(createdData.id).toBe(id);
        
        const updatedData = await updatePromise;
        console.log('Received updated data:', updatedData);
        expect(updatedData).toBeDefined();
        expect(updatedData.data.name).toBe('Realtime Test');
        expect(updatedData.data.age).toBe(age + 1);
        expect(updatedData.id).toBe(id);

        const deletedData = await deletePromise;
        console.log('Received deleted data:', deletedData);
        expect(deletedData).toBeDefined();
        expect(deletedData.data.name).toBe('Realtime Test');
        expect(deletedData.data.age).toBe(age + 1);
        expect(deletedData.id).toBe(id);
    });
});
}