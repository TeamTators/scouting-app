alter table "core"."account_notification" alter column "account_id" set not null;

alter table "core"."account_notification" alter column "link" drop not null;


