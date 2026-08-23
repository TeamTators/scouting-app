
  create policy "User can edit their own notifications"
  on "core"."account_notification"
  as permissive
  for all
  to public
using ((auth.uid() = account_id))
with check ((auth.uid() = account_id));



