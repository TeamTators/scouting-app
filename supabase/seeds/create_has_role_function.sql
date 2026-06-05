create or replace function core.has_role(required_role text)
returns boolean
language sql
security definer
set search_path = core, public
as $$
  select exists (
    select 1
    from core.role_account ru
    join core.role r on ru.role = r.id
    where ru.account = auth.uid()
      and r.name = required_role
  );
$$;