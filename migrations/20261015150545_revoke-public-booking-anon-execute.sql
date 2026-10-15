-- La reserva pública entra solo por /api/public-booking, que usa la key de servidor (rol project_admin).
-- Quitamos EXECUTE a anon y authenticated para que nadie pueda saltear la ruta con la anon key:
-- sin esto, cualquiera puede crear clientes, retener asientos y disparar emails directamente por RPC.
revoke execute on function public.create_public_booking(uuid, uuid, timestamptz, text, text, text, text)
  from anon, authenticated;
