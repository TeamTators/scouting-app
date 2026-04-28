do $$
declare
  schema_name text;
begin
  foreach schema_name in array array[
    'tators_app_kit'
  ]
  loop
    execute format('create schema if not exists %I', schema_name);

    execute format('grant usage on schema %I to anon, authenticated, service_role', schema_name);

    execute format('grant all privileges on all tables in schema %I to anon, authenticated, service_role', schema_name);

    execute format('grant all privileges on all sequences in schema %I to anon, authenticated, service_role', schema_name);

    -- Use "functions" instead of "routines" for better compatibility
    execute format('grant all privileges on all functions in schema %I to anon, authenticated, service_role', schema_name);

    -- Default privileges must match the role that creates objects
    execute format(
      'alter default privileges for role postgres in schema %I grant all privileges on tables to anon, authenticated, service_role',
      schema_name
    );

    execute format(
      'alter default privileges for role postgres in schema %I grant all privileges on sequences to anon, authenticated, service_role',
      schema_name
    );

    execute format(
      'alter default privileges for role postgres in schema %I grant all privileges on functions to anon, authenticated, service_role',
      schema_name
    );

  end loop;
end $$;