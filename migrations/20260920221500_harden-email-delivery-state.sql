create or replace function public.complete_email_outbox(p_id uuid, p_provider_id text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_webhook_event text;
  v_status text;
begin
  select event_type into v_webhook_event
  from public.email_webhook_events
  where provider_id = p_provider_id
  order by created_at desc
  limit 1;

  v_status := case v_webhook_event
    when 'email.delivered' then 'delivered'
    when 'email.bounced' then 'bounced'
    when 'email.complained' then 'complained'
    when 'email.suppressed' then 'suppressed'
    when 'email.failed' then 'failed'
    else 'sent'
  end;

  update public.email_outbox
  set status = v_status,
      provider_id = p_provider_id,
      sent_at = now(),
      delivered_at = case when v_status = 'delivered' then now() else delivered_at end,
      locked_at = null,
      last_error = null,
      updated_at = now()
  where id = p_id and status = 'processing';
end;
$$;

create or replace function public.fail_email_outbox(p_id uuid, p_error text)
returns void
language sql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  update public.email_outbox
  set status = 'failed',
      locked_at = null,
      last_error = left(coalesce(p_error, 'Error permanente'), 2000),
      updated_at = now()
  where id = p_id and status = 'processing';
$$;

revoke execute on function public.complete_email_outbox(uuid, text) from public, anon, authenticated;
revoke execute on function public.fail_email_outbox(uuid, text) from public, anon, authenticated;
