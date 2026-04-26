
  create policy "Enable all on test for everyone"
  on "sveltekit_template"."test"
  as permissive
  for all
  to public
using (true)
with check (true);



