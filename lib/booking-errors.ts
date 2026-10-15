// Mensajes que las RPC de reserva lanzan a propósito. Son texto en español pensado para el cliente.
// Cualquier otro error de base de datos se responde con un mensaje genérico y no se expone.
const PUBLIC_BOOKING_MESSAGES = new Set([
  "Negocio no disponible para reservas",
  "Servicio no disponible",
  "Cliente no disponible para este negocio",
  "El horario ya no esta disponible",
  "El horario seleccionado no esta habilitado",
  "El horario seleccionado ya esta ocupado",
  "El horario ya no tiene cupos disponibles",
  "El horario se superpone con otro servicio",
  "El cliente necesita un email para reservar este horario",
  "Este email ya tiene una reserva para el horario",
  "Demasiados horarios solicitados",
  "Datos de reserva incompletos",
  "Nombre invalido",
  "Email invalido",
  "Telefono invalido",
  "Mensaje demasiado largo",
]);

export const GENERIC_BOOKING_ERROR = "No se pudo completar la reserva. Probá de nuevo en unos minutos.";

export function getPublicBookingErrorMessage(rpcMessage: string | null | undefined) {
  if (rpcMessage && PUBLIC_BOOKING_MESSAGES.has(rpcMessage)) return rpcMessage;
  return null;
}
