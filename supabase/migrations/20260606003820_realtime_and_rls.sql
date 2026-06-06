set check_function_bodies = off;

CREATE OR REPLACE FUNCTION core.has_role(required_role text)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'core', 'public'
AS $function$
  select exists (
    select 1
    from core.role_account ru
    join core.role r on ru.role = r.id
    where ru.account = auth.uid()
      and r.name = required_role
  );
$function$
;


