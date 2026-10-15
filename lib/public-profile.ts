export function normalizeWhatsAppPhone(value: string | null | undefined) {
  const phone = String(value ?? "").replace(/\D/g, "");
  return phone || null;
}

export function normalizePublicAddress(value: string | null | undefined) {
  const address = String(value ?? "").trim();
  return address || null;
}

export function formatWhatsAppPhone(value: string | null | undefined) {
  const phone = normalizeWhatsAppPhone(value);
  return phone ? `+${phone}` : null;
}

export function getWhatsAppUrl(phone: string | null | undefined, message: string) {
  const normalizedPhone = normalizeWhatsAppPhone(phone);
  if (!normalizedPhone) return null;
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

export function getGoogleMapsEmbedUrl(address: string | null | undefined) {
  const normalizedAddress = normalizePublicAddress(address);
  if (!normalizedAddress) return null;
  return `https://maps.google.com/maps?q=${encodeURIComponent(normalizedAddress)}&output=embed`;
}

export function getGoogleMapsSearchUrl(address: string | null | undefined) {
  const normalizedAddress = normalizePublicAddress(address);
  if (!normalizedAddress) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(normalizedAddress)}`;
}

export function getPublicAvailabilitySummary(slots: ServiceAvailabilitySlot[], appointments: Appointment[], timeZone: string | null | undefined) {
  const dates = new Set<string>();
  const weekdays = new Set<number>();
  const times: string[] = [];

  for (const slot of slots) {
    if (!slot.is_active || new Date(slot.starts_at).getTime() <= Date.now() || getSlotOccupancy(slot, appointments).remaining === 0) continue;

    const dateKey = toDateKey(slot.starts_at, timeZone);
    dates.add(dateKey);
    weekdays.add(getWeekdayOfDateKey(dateKey));
    times.push(toTimeKey(slot.starts_at, timeZone));
  }

  const weekdayLabel = Array.from(weekdays).sort((a, b) => a - b).map((day) => WEEKDAYS[day]).join(", ");
  const sortedTimes = times.sort();

  return {
    dateCount: dates.size,
    schedule: weekdayLabel && sortedTimes.length ? `${weekdayLabel} · ${sortedTimes[0]}–${sortedTimes.at(-1)}` : null,
  };
}
import { getSlotOccupancy, type Appointment, type ServiceAvailabilitySlot } from "@/lib/citadely-db";
import { getWeekdayOfDateKey, toDateKey, toTimeKey } from "@/lib/time";

const WEEKDAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
