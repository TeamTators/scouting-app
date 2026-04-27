alter table "sveltekit_template"."test" drop column "archive";

alter table "sveltekit_template"."test" add column "archived" boolean not null default false;


