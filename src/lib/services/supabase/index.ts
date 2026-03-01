import type { Database } from "$lib/types/supabase";
import { schemaName } from "$lib/types/supabase-schema";
import { createClient } from "@supabase/supabase-js";

export default createClient<Database>(
    __APP_ENV__.supabase.url,
    __APP_ENV__.supabase.anon_key,
    {
        db: {
            schema: schemaName
        }
    }
);