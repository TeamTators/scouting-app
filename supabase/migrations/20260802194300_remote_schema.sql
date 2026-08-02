
  create table "core"."cached_request" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "archived" boolean not null default false,
    "headers" text not null,
    "response" text not null,
    "status" smallint not null,
    "ttl" integer not null,
    "url" text not null
      );


alter table "core"."cached_request" enable row level security;

CREATE UNIQUE INDEX cached_request_pkey ON core.cached_request USING btree (id);

CREATE UNIQUE INDEX cached_request_url_key ON core.cached_request USING btree (url);

alter table "core"."cached_request" add constraint "cached_request_pkey" PRIMARY KEY using index "cached_request_pkey";

alter table "core"."cached_request" add constraint "cached_request_url_key" UNIQUE using index "cached_request_url_key";

grant delete on table "core"."cached_request" to "anon";

grant insert on table "core"."cached_request" to "anon";

grant references on table "core"."cached_request" to "anon";

grant select on table "core"."cached_request" to "anon";

grant trigger on table "core"."cached_request" to "anon";

grant truncate on table "core"."cached_request" to "anon";

grant update on table "core"."cached_request" to "anon";

grant delete on table "core"."cached_request" to "authenticated";

grant insert on table "core"."cached_request" to "authenticated";

grant references on table "core"."cached_request" to "authenticated";

grant select on table "core"."cached_request" to "authenticated";

grant trigger on table "core"."cached_request" to "authenticated";

grant truncate on table "core"."cached_request" to "authenticated";

grant update on table "core"."cached_request" to "authenticated";

grant delete on table "core"."cached_request" to "service_role";

grant insert on table "core"."cached_request" to "service_role";

grant references on table "core"."cached_request" to "service_role";

grant select on table "core"."cached_request" to "service_role";

grant trigger on table "core"."cached_request" to "service_role";

grant truncate on table "core"."cached_request" to "service_role";

grant update on table "core"."cached_request" to "service_role";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_schemas_and_tables()
 RETURNS TABLE(schema_name text, table_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  return query
  select 
    t.table_schema::text,
    t.table_name::text
  from information_schema.tables t
  where t.table_schema not in ('pg_catalog', 'information_schema') -- filters out internal system schemas
    and t.table_type = 'BASE TABLE' -- optional: filters out views, change to include views if needed
  order by t.table_schema, t.table_name;
end;
$function$
;


