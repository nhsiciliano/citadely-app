import { insforge } from "@/lib/insforge";
import type { Service } from "@/lib/citadely-db";

// Mirrors the checks in public.upsert_service_with_slots; the database is the final authority.
export const SERVICE_LIMITS = {
  nameMax: 120,
  descriptionMax: 1000,
  imageUrlMax: 2000,
  durationMin: 1,
  durationMax: 1440,
  priceMaxCents: 100_000_000,
} as const;

/** Strict "1234.50" / "1234,5" parser. Returns null for empty, negative or malformed values. */
export function parseMoneyToCents(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? "").trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  return Math.round(Number(text) * 100);
}

export type ServiceInput = {
  name: string;
  description: string;
  imageUrl: string;
  durationMinutes: number;
  priceCents: number;
  depositType: Service["deposit_type"];
  depositValueCents: number;
};

/** Reads and validates the service drawer form. Returns a user-facing message when something is wrong. */
export function readServiceForm(form: FormData): { input: ServiceInput; error: null } | { input: null; error: string } {
  const name = String(form.get("name") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const imageUrl = String(form.get("image_url") ?? "").trim();
  const duration = Number(String(form.get("duration_minutes") ?? "").trim());
  const priceCents = parseMoneyToCents(form.get("price"));
  const depositType = String(form.get("deposit_type") ?? "free") as Service["deposit_type"];

  if (!name) return { input: null, error: "Ingresá el nombre del servicio." };
  if (name.length > SERVICE_LIMITS.nameMax) return { input: null, error: `El nombre puede tener hasta ${SERVICE_LIMITS.nameMax} caracteres.` };
  if (description.length > SERVICE_LIMITS.descriptionMax) return { input: null, error: `La descripción puede tener hasta ${SERVICE_LIMITS.descriptionMax} caracteres.` };
  if (imageUrl.length > SERVICE_LIMITS.imageUrlMax) return { input: null, error: "La URL de la imagen es demasiado larga." };
  if (!Number.isInteger(duration) || duration < SERVICE_LIMITS.durationMin || duration > SERVICE_LIMITS.durationMax) {
    return { input: null, error: `La duración debe ser un número entero de minutos entre ${SERVICE_LIMITS.durationMin} y ${SERVICE_LIMITS.durationMax}.` };
  }
  if (priceCents === null || priceCents > SERVICE_LIMITS.priceMaxCents) {
    return { input: null, error: "Ingresá un precio válido, con hasta dos decimales (por ejemplo 15000 o 15000,50)." };
  }
  if (!["free", "deposit", "full"].includes(depositType)) return { input: null, error: "Elegí cómo se cobra al reservar." };

  let depositValueCents = 0;
  if (depositType === "full") depositValueCents = priceCents;
  if (depositType !== "free" && priceCents === 0) {
    return { input: null, error: "Para cobrar al reservar, el precio tiene que ser mayor a cero." };
  }
  if (depositType === "deposit") {
    const deposit = parseMoneyToCents(form.get("deposit_value"));
    if (deposit === null || deposit < 1) return { input: null, error: "Ingresá el monto de la seña (mayor a cero, con hasta dos decimales)." };
    if (deposit > priceCents) return { input: null, error: "La seña no puede superar el precio del servicio." };
    depositValueCents = deposit;
  }

  return { input: { name, description, imageUrl, durationMinutes: duration, priceCents, depositType, depositValueCents }, error: null };
}

export type DesiredSlot = { startsAt: Date; capacity: number };

/** Creates (serviceId null) or updates a service and syncs its availability in one transaction. */
export async function upsertServiceWithSlots({
  businessId,
  serviceId,
  input,
  slots,
  windowStart,
  windowEnd,
}: {
  businessId: string;
  serviceId: string | null;
  input: ServiceInput;
  slots: DesiredSlot[];
  windowStart: Date;
  windowEnd: Date;
}) {
  return insforge.database.rpc("upsert_service_with_slots", {
    p_business_id: businessId,
    p_service_id: serviceId,
    p_name: input.name,
    p_description: input.description,
    p_image_url: input.imageUrl,
    p_duration_minutes: input.durationMinutes,
    p_price_cents: input.priceCents,
    p_deposit_type: input.depositType,
    p_deposit_value_cents: input.depositValueCents,
    p_slots: slots.map((slot) => ({ starts_at: slot.startsAt.toISOString(), capacity: slot.capacity })),
    p_window_start: windowStart.toISOString(),
    p_window_end: windowEnd.toISOString(),
  });
}
