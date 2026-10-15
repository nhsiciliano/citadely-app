import type { InsForgeClient } from "@insforge/sdk";
import { getErrorMessage } from "@/lib/auth";
import { fetchBusinessAccessState, type BusinessAccessState } from "@/lib/business-access";
import type { Appointment, Business, BusinessFaq, BusinessGalleryImage, Service, ServiceAvailabilitySlot } from "@/lib/citadely-db";

// Carga del dataset del panel. La usan el layout de /negocio en el servidor (primer render) y el
// WorkspaceProvider en el navegador (refresh e historial), con el cliente que corresponda a cada lado.

type DatabaseClient = Pick<InsForgeClient, "database">;

export type WorkspaceData = {
  access: BusinessAccessState;
  services: Service[];
  appointments: Appointment[];
  availabilitySlots: ServiceAvailabilitySlot[];
  galleryImages: BusinessGalleryImage[];
  faqs: BusinessFaq[];
};

export type InitialWorkspace = WorkspaceData & {
  business: Business;
  userEmail: string;
  historyStart: string;
  /** Origen de la request, para que las URLs públicas coincidan entre servidor y navegador. */
  publicOrigin: string;
};

const PAGE_SIZE = 500;
// Past appointments grow without bound, so only recent history is loaded up front (everything from here on,
// including all future appointments, which the slot occupancy depends on). 45 days covers the current month.
const HISTORY_WINDOW_DAYS = 45;
const APPOINTMENT_SELECT = "*, clients(name,email,phone), services(name,duration_minutes,price_cents)";
const SLOT_SELECT = "id,business_id,service_id,starts_at,ends_at,is_active,capacity";

export function getHistoryStart(now = Date.now()) {
  return new Date(now - HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

// Loads every row of a query in pages of PAGE_SIZE, within [from, to) on starts_at.
export async function loadRange<T>(
  client: DatabaseClient,
  table: "appointments" | "service_availability_slots",
  businessId: string,
  from: string,
  to?: string,
): Promise<T[]> {
  const rows: T[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = client.database
      .from(table)
      .select(table === "appointments" ? APPOINTMENT_SELECT : SLOT_SELECT)
      .eq("business_id", businessId)
      .gte("starts_at", from);
    if (to) query = query.lt("starts_at", to);

    const { data, error } = await query
      .order("starts_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(getErrorMessage(error));
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

export async function loadWorkspaceData(client: DatabaseClient, businessId: string, windowStart: string): Promise<WorkspaceData> {
  const [access, servicesResult, appointments, availabilitySlots, galleryResult, faqResult] = await Promise.all([
    fetchBusinessAccessState(client, businessId),
    client.database.from("services").select("*").eq("business_id", businessId).order("created_at", { ascending: false }),
    loadRange<Appointment>(client, "appointments", businessId, windowStart),
    loadRange<ServiceAvailabilitySlot>(client, "service_availability_slots", businessId, windowStart),
    client.database
      .from("business_gallery_images")
      .select("id,business_id,image_url,image_key,sort_order")
      .eq("business_id", businessId)
      .order("sort_order", { ascending: true })
      .limit(10),
    client.database
      .from("business_faqs")
      .select("id,business_id,question,answer,sort_order")
      .eq("business_id", businessId)
      .order("sort_order", { ascending: true })
      .limit(10),
  ]);

  const workspaceError = servicesResult.error ?? galleryResult.error ?? faqResult.error;
  if (workspaceError) throw new Error(getErrorMessage(workspaceError));

  return {
    access,
    services: (servicesResult.data ?? []) as Service[],
    appointments,
    availabilitySlots,
    galleryImages: (galleryResult.data ?? []) as BusinessGalleryImage[],
    faqs: (faqResult.data ?? []) as BusinessFaq[],
  };
}
