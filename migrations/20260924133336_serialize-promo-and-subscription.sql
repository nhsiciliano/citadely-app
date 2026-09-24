create or replace function public.claim_subscription_operation(
  p_request_id uuid,
  p_business_id uuid,
  p_operation_type text,
  p_requested_plan text default null
)
returns table(operation_id uuid, claim_state text, operation_result jsonb)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_existing public.subscription_operations%rowtype;
begin
  -- El canje promocional bloquea la misma fila; uno de los flujos espera al otro.
  perform 1 from public.businesses where id = p_business_id for update;
  if not found then raise exception 'Negocio no encontrado'; end if;

  if p_operation_type not in ('select_plan', 'cancel') then
    raise exception 'Operacion de suscripcion invalida';
  end if;
  if p_operation_type = 'select_plan' and p_requested_plan not in ('essential', 'pro') then
    raise exception 'Plan de suscripcion invalido';
  end if;

  select * into v_existing
  from public.subscription_operations
  where request_id = p_request_id;

  if found then
    if v_existing.business_id <> p_business_id
      or v_existing.operation_type <> p_operation_type
      or v_existing.requested_plan is distinct from p_requested_plan then
      raise exception 'La solicitud idempotente no coincide';
    end if;

    if v_existing.status = 'completed' then
      return query select v_existing.id, 'completed'::text, v_existing.result;
      return;
    end if;

    if v_existing.status = 'processing' and v_existing.lease_expires_at > now() then
      return query select v_existing.id, 'processing'::text, v_existing.result;
      return;
    end if;

    update public.subscription_operations
    set status = 'processing', error_message = null,
        lease_expires_at = now() + interval '2 minutes', updated_at = now()
    where id = v_existing.id;
    return query select v_existing.id, 'claimed'::text, '{}'::jsonb;
    return;
  end if;

  update public.subscription_operations
  set status = 'failed', error_message = 'Operacion expirada', updated_at = now()
  where business_id = p_business_id
    and status = 'processing'
    and lease_expires_at <= now();

  if exists (
    select 1 from public.subscription_operations
    where business_id = p_business_id and status = 'processing'
  ) then
    return query select null::uuid, 'busy'::text, '{}'::jsonb;
    return;
  end if;

  insert into public.subscription_operations(request_id, business_id, operation_type, requested_plan)
  values (p_request_id, p_business_id, p_operation_type, p_requested_plan)
  returning id into operation_id;

  claim_state := 'claimed';
  operation_result := '{}'::jsonb;
  return next;
exception
  when unique_violation then
    return query select null::uuid, 'busy'::text, '{}'::jsonb;
end;
$$;
