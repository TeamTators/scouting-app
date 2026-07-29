create or replace function get_schemas_and_tables()
returns table (
  schema_name text,
  table_name text
) 
language plpgsql
security definer
as $$
begin
  return query
  select 
    t.table_schema::text,
    t.table_name::text
  from information_schema.tables t
  where t.table_schema not in ('pg_catalog', 'information_schema') -- filters out internal system schemas
    and t.table_type = 'BASE TABLE' -- optional: filters out views, change to include views if needed
  order by t.table_schema, t.table_name;
end;
$$;