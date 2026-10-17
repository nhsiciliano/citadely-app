-- Rate limit y tope de reservas abiertas para la reserva publica.
-- /api/public-booking llama a register_public_booking_attempt antes de create_public_booking.
-- Patron de promo_redemption_attempts: la tabla solo la toca la funcion SECURITY DEFINER.

create table public.public_booking_attempts (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  -- HMAC de la IP calculado en el servidor: no se guardan IPs ni emails en claro.
  ip_hash text,
  email_hash text not null,
  attempted_at timestamptz not null default now()
);

create index public_booking_attempts_ip_time_idx
  on public.public_booking_attempts(ip_hash, attempted_at desc) where ip_hash is not null;
create index public_booking_attempts_email_time_idx
  on public.public_booking_attempts(email_hash, attempted_at desc);
create index public_booking_attempts_business_time_idx
  on public.public_booking_attempts(business_id, attempted_at desc);
create index public_booking_attempts_time_idx
  on public.public_booking_attempts(attempted_at);

alter table public.public_booking_attempts enable row level security;
revoke all on public.public_booking_attempts from public, anon, authenticated;
revoke all on sequence public.public_booking_attempts_id_seq from public, anon, authenticated;

-- Devuelve NULL si el intento se permite (y queda registrado) o un codigo de rechazo:
--   'ip' | 'email' | 'business'      demasiados intentos en la ventana
--   'pending_email' | 'pending_phone' demasiadas reservas con sena abierta
-- Los rechazos no se registran (igual que promo_redemption_attempts).
create or replace function public.register_public_booking_attempt(
  p_business_id uuid,
  p_email text,
  p_phone text,
  p_ip_hash text default null
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  c_ip_limit constant integer := 8;          -- por IP, 10 min
  c_email_limit constant integer := 5;       -- por email, 15 min
  c_business_limit constant integer := 60;   -- por negocio, 10 min
  c_pending_email_limit constant integer := 3;
  c_pending_phone_limit constant integer := 5;
  v_now timestamptz := pg_catalog.now();
  v_email text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, '')));
  v_phone text := pg_catalog.regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_email_hash text;
  v_count integer;
begin
  if p_business_id is null or v_email = '' then
    raise exception 'Datos de reserva incompletos';
  end if;

  v_email_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(v_email, 'UTF8')), 'hex');

  -- Orden fijo de locks (ip, email) para evitar deadlocks y que contar + insertar sea atomico por clave.
  if p_ip_hash is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pba:ip:' || p_ip_hash, 20261015));
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pba:email:' || v_email_hash, 20261015));

  delete from public.public_booking_attempts where attempted_at < v_now - interval '1 day';

  if p_ip_hash is not null then
    select count(*) into v_count from public.public_booking_attempts
    where ip_hash = p_ip_hash and attempted_at >= v_now - interval '10 minutes';
    if v_count >= c_ip_limit then return 'ip'; end if;
  end if;

  select count(*) into v_count from public.public_booking_attempts
  where email_hash = v_email_hash and attempted_at >= v_now - interval '15 minutes';
  if v_count >= c_email_limit then return 'email'; end if;

  select count(*) into v_count from public.public_booking_attempts
  where business_id = p_business_id and attempted_at >= v_now - interval '10 minutes';
  if v_count >= c_business_limit then return 'business'; end if;

  -- Reservas con sena abierta (pending_payment sin vencer) del mismo email o telefono, en cualquier negocio.
  select count(*) into v_count
  from public.appointments a
  join public.clients c on c.id = a.client_id
  where a.status = 'pending_payment'
    and a.deposit_expires_at > v_now
    and pg_catalog.lower(c.email) = v_email;
  if v_count >= c_pending_email_limit then return 'pending_email'; end if;

  if pg_catalog.length(v_phone) >= 6 then
    select count(*) into v_count
    from public.appointments a
    join public.clients c on c.id = a.client_id
    where a.status = 'pending_payment'
      and a.deposit_expires_at > v_now
      and pg_catalog.regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') = v_phone;
    if v_count >= c_pending_phone_limit then return 'pending_phone'; end if;
  end if;

  insert into public.public_booking_attempts(business_id, ip_hash, email_hash)
  values (p_business_id, p_ip_hash, v_email_hash);
  return null;
end;
$$;

revoke all on function public.register_public_booking_attempt(uuid, text, text, text) from public, anon, authenticated;
