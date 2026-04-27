
  create policy "Enable all on test for everyone"
  on "tators-app-kit"."test"
  as permissive
  for all
  to public
using (true)
with check (true);



