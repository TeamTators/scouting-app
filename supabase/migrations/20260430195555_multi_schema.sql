create schema if not exists "test";

drop policy "Enable all on test for everyone" on "core"."test";

revoke delete on table "core"."test" from "anon";

revoke insert on table "core"."test" from "anon";

revoke references on table "core"."test" from "anon";

revoke select on table "core"."test" from "anon";

revoke trigger on table "core"."test" from "anon";

revoke truncate on table "core"."test" from "anon";

revoke update on table "core"."test" from "anon";

revoke delete on table "core"."test" from "authenticated";

revoke insert on table "core"."test" from "authenticated";

revoke references on table "core"."test" from "authenticated";

revoke select on table "core"."test" from "authenticated";

revoke trigger on table "core"."test" from "authenticated";

revoke truncate on table "core"."test" from "authenticated";

revoke update on table "core"."test" from "authenticated";

revoke delete on table "core"."test" from "service_role";

revoke insert on table "core"."test" from "service_role";

revoke references on table "core"."test" from "service_role";

revoke select on table "core"."test" from "service_role";

revoke trigger on table "core"."test" from "service_role";

revoke truncate on table "core"."test" from "service_role";

revoke update on table "core"."test" from "service_role";

alter table "core"."test" drop constraint "test_pkey";

drop index if exists "core"."test_pkey";

drop table "core"."test";


  create table "public"."_template" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "archived" boolean not null default false
      );


alter table "public"."_template" enable row level security;


  create table "test"."test" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "archived" boolean not null default false,
    "name" text not null,
    "age" bigint not null
      );


alter table "test"."test" enable row level security;

CREATE UNIQUE INDEX _template_pkey ON public._template USING btree (id);

CREATE UNIQUE INDEX test_pkey ON test.test USING btree (id);

alter table "public"."_template" add constraint "_template_pkey" PRIMARY KEY using index "_template_pkey";

alter table "test"."test" add constraint "test_pkey" PRIMARY KEY using index "test_pkey";

grant delete on table "public"."_template" to "anon";

grant insert on table "public"."_template" to "anon";

grant references on table "public"."_template" to "anon";

grant select on table "public"."_template" to "anon";

grant trigger on table "public"."_template" to "anon";

grant truncate on table "public"."_template" to "anon";

grant update on table "public"."_template" to "anon";

grant delete on table "public"."_template" to "authenticated";

grant insert on table "public"."_template" to "authenticated";

grant references on table "public"."_template" to "authenticated";

grant select on table "public"."_template" to "authenticated";

grant trigger on table "public"."_template" to "authenticated";

grant truncate on table "public"."_template" to "authenticated";

grant update on table "public"."_template" to "authenticated";

grant delete on table "public"."_template" to "service_role";

grant insert on table "public"."_template" to "service_role";

grant references on table "public"."_template" to "service_role";

grant select on table "public"."_template" to "service_role";

grant trigger on table "public"."_template" to "service_role";

grant truncate on table "public"."_template" to "service_role";

grant update on table "public"."_template" to "service_role";

grant delete on table "test"."test" to "anon";

grant insert on table "test"."test" to "anon";

grant references on table "test"."test" to "anon";

grant select on table "test"."test" to "anon";

grant trigger on table "test"."test" to "anon";

grant truncate on table "test"."test" to "anon";

grant update on table "test"."test" to "anon";

grant delete on table "test"."test" to "authenticated";

grant insert on table "test"."test" to "authenticated";

grant references on table "test"."test" to "authenticated";

grant select on table "test"."test" to "authenticated";

grant trigger on table "test"."test" to "authenticated";

grant truncate on table "test"."test" to "authenticated";

grant update on table "test"."test" to "authenticated";

grant delete on table "test"."test" to "service_role";

grant insert on table "test"."test" to "service_role";

grant references on table "test"."test" to "service_role";

grant select on table "test"."test" to "service_role";

grant trigger on table "test"."test" to "service_role";

grant truncate on table "test"."test" to "service_role";

grant update on table "test"."test" to "service_role";


