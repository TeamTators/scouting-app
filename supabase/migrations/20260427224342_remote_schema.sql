alter table "sveltekit_template"."account_notification" alter column "read" set default false;

alter table "sveltekit_template"."account_notification" alter column "read" set data type boolean using "read"::boolean;


  create policy "Enable insert for authenticated users only"
  on "storage"."buckets"
  as permissive
  for all
  to public
with check (true);



  create policy "Enable read access for all users"
  on "storage"."objects"
  as permissive
  for all
  to public
using (true)
with check (true);



