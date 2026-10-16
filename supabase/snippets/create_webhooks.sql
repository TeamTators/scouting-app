create extension if not exists "http" with schema "extensions";

-- select 
--   status, 
--   content::text -- cast text response to JSONB for easier querying
-- from 
--   http_get('https://github.com');



begin;

-- ============================================================
-- 1. Create the generic webhook function
-- ============================================================

create or replace function public.dispatch_table_webhook()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_token text;
  v_timeout integer;
  v_headers extensions.http_header[];
  v_request extensions.http_request;
  v_response extensions.http_response;
  v_payload jsonb;
begin
  -- Read configuration from Supabase Vault.
  select decrypted_secret into strict v_url
  from vault.decrypted_secrets
  where name = 'webhook_url';

  select decrypted_secret into strict v_token
  from vault.decrypted_secrets
  where name = 'webhook_auth_token';

  select decrypted_secret::integer into strict v_timeout
  from vault.decrypted_secrets
  where name = 'webhook_timeout_ms';

  v_headers := array[
    extensions.http_header(
      'Authorization',
      'Bearer ' || v_token
    ),
    extensions.http_header(
      'Content-Type',
      'application/json'
    )
  ];

  -- Build the webhook payload.
  v_payload := jsonb_build_object(
    'schema', TG_TABLE_SCHEMA,
    'table', TG_TABLE_NAME,
    'new',
      case
        when TG_OP = 'DELETE' then null
        else to_jsonb(NEW)
      end,
    'old',
      case
        when TG_OP = 'INSERT' then null
        else to_jsonb(OLD)
      end,
    'type', lower(TG_OP)
  );

  -- Construct the HTTP request.
  v_request := ROW(
    'POST',
    v_url,
    v_headers,
    'application/json',
    v_payload::text
  )::extensions.http_request;

  -- Set timeout in milliseconds.
  if v_timeout > 0 then
    perform extensions.http_set_curlopt(
      'CURLOPT_TIMEOUT_MS',
      v_timeout::text
    );
  end if;

  -- Send the request synchronously.
  v_response := extensions.http(v_request);

  -- Log non-2xx responses.
  if v_response.status < 200 or v_response.status >= 300 then
    raise warning
      'Webhook HTTP status % for table %.%: %',
      v_response.status,
      TG_TABLE_SCHEMA,
      TG_TABLE_NAME,
      v_response.content;
  end if;

  -- Preserve the original row operation.
  if TG_OP = 'DELETE' then
    return OLD;
  end if;

  return NEW;
end;
$$;


-- ============================================================
-- 2. Install triggers on all selected base tables
-- ============================================================

do $$
declare
  v_schema text;
  v_table text;
  v_count integer := 0;
begin
  foreach v_schema in array array[
    'core',
    'public',
    'test'
  ]
  loop
    for v_table in
      select table_name
      from information_schema.tables
      where table_schema = v_schema
        and table_type = 'BASE TABLE'
    loop
      execute format(
        'drop trigger if exists supabase_webhook on %I.%I',
        v_schema,
        v_table
      );

      execute format(
        'create trigger supabase_webhook
         after insert or update or delete
         on %I.%I
         for each row
         execute function public.dispatch_table_webhook()',
        v_schema,
        v_table
      );

      v_count := v_count + 1;
    end loop;
  end loop;

  raise notice 'Created webhook triggers on % tables.', v_count;
end;
$$;

commit;