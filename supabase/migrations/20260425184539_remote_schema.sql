
  create policy "Enable all on test for everyone"
  on "tators_app_kit"."test"
  as permissive
  for all
  to public
using (true)
with check (true);



