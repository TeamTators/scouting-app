import type { Database } from "$lib/types/supabase";
import { createClient } from "@supabase/supabase-js";

export default createClient<Database>(
    __APP_ENV__.supabase.url,
    __APP_ENV__.supabase.anon_key
);