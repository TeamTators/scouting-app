import supabase from '../src/lib/services/supabase';
import { SupaStruct } from '../src/lib/services/supabase/supastruct';

export default async () => {
    const struct = new SupaStruct('test');
    // const res = await struct.new(...Array.from({ length: 10 }, (_, i) => ({ name: `Test: ${i}`, age: Math.floor(Math.random() * 100) }))).await();

    // console.log(res);
    const res = await struct.search({ 
        type: 'or',
        conditions: [
            // {
            //     field: 'age', 
            //     operator: 'gt',
            //     value: 90,
            // },
            // {
            //     field: 'age',
            //     operator: 'lt',
            //     value: 10,
            // },
            {
                field: 'name',
                operator: 'like',
                value: '%Test: 5%',
            }
        ]
    }).await().unwrap();
    // const res = await struct.all().await().unwrap();
    console.log(res);
};