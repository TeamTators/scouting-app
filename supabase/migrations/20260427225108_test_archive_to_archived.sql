alter table "core"."test" drop column "archive";

alter table "core"."test" add column "archived" boolean not null default false;


