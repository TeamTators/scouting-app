
  create policy "Allow all to all"
  on "test"."test"
  as permissive
  for all
  to public
using (true)
with check (true);



