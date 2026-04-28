alter table "tators_app_kit"."test" drop column "archive";

alter table "tators_app_kit"."test" add column "archived" boolean not null default false;


