do $$
declare
  schema_name text;
begin
  foreach schema_name in array array[
    'test',
    'core'
  ]
  loop
    -- 1. Create schema
    execute format('create schema if not exists %I', schema_name);

    -- 2. Ensure postgres owns it (Critical for self-hosted grant authority)
    execute format('alter schema %I owner to postgres', schema_name);

    -- 3. Grant usage to all API roles AND the authenticator gateway
    execute format('grant usage on schema %I to authenticated, service_role, authenticator', schema_name);

    -- 4. Grant privileges on EXISTING objects
    execute format('grant all privileges on all tables in schema %I to authenticated, service_role', schema_name);
    execute format('grant all privileges on all sequences in schema %I to authenticated, service_role', schema_name);
    execute format('grant all privileges on all functions in schema %I to authenticated, service_role', schema_name);

    -- 5. Set default privileges for FUTURE objects created by postgres
    execute format(
      'alter default privileges for role postgres in schema %I grant all privileges on tables to authenticated, service_role',
      schema_name
    );

    execute format(
      'alter default privileges for role postgres in schema %I grant all privileges on sequences to authenticated, service_role',
      schema_name
    );

    execute format(
      'alter default privileges for role postgres in schema %I grant all privileges on functions to authenticated, service_role',
      schema_name
    );

  end loop;
end $$;