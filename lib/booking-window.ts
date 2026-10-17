// Public booking page: only the nearest slots are loaded.
// get_public_slot_occupancy rejects more than 1000 slot ids ("Demasiados horarios solicitados"),
// so the page must never ask for more than PUBLIC_SLOT_LIMIT slots.
export const PUBLIC_BOOKING_WINDOW_DAYS = 120;
export const PUBLIC_SLOT_LIMIT = 1000;

export function getPublicBookingWindow(now = new Date()) {
  const end = new Date(now.getTime() + PUBLIC_BOOKING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return { from: now.toISOString(), to: end.toISOString() };
}
