set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.dispatch_table_webhook()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;


CREATE TRIGGER supabase_webhook AFTER INSERT OR DELETE OR UPDATE ON core.account_notification FOR EACH ROW EXECUTE FUNCTION public.dispatch_table_webhook();

CREATE TRIGGER supabase_webhook AFTER INSERT OR DELETE OR UPDATE ON core.admin FOR EACH ROW EXECUTE FUNCTION public.dispatch_table_webhook();

CREATE TRIGGER supabase_webhook AFTER INSERT OR DELETE OR UPDATE ON core.cached_request FOR EACH ROW EXECUTE FUNCTION public.dispatch_table_webhook();

CREATE TRIGGER supabase_webhook AFTER INSERT OR DELETE OR UPDATE ON core.profile FOR EACH ROW EXECUTE FUNCTION public.dispatch_table_webhook();

CREATE TRIGGER supabase_webhook AFTER INSERT OR DELETE OR UPDATE ON core.role FOR EACH ROW EXECUTE FUNCTION public.dispatch_table_webhook();

CREATE TRIGGER supabase_webhook AFTER INSERT OR DELETE OR UPDATE ON core.role_account FOR EACH ROW EXECUTE FUNCTION public.dispatch_table_webhook();

CREATE TRIGGER supabase_webhook AFTER INSERT OR DELETE OR UPDATE ON core.session FOR EACH ROW EXECUTE FUNCTION public.dispatch_table_webhook();

CREATE TRIGGER supabase_webhook AFTER INSERT OR DELETE OR UPDATE ON core.session_tab FOR EACH ROW EXECUTE FUNCTION public.dispatch_table_webhook();


CREATE TRIGGER supabase_webhook AFTER INSERT OR DELETE OR UPDATE ON public._template FOR EACH ROW EXECUTE FUNCTION public.dispatch_table_webhook();

CREATE TRIGGER supabase_webhook AFTER INSERT OR DELETE OR UPDATE ON test.join_test FOR EACH ROW EXECUTE FUNCTION public.dispatch_table_webhook();

CREATE TRIGGER supabase_webhook AFTER INSERT OR DELETE OR UPDATE ON test.test FOR EACH ROW EXECUTE FUNCTION public.dispatch_table_webhook();


