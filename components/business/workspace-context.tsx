"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getErrorMessage, getPostAuthPath } from "@/lib/auth";
import type { Appointment, Business, BusinessFaq, BusinessGalleryImage, Service, ServiceAvailabilitySlot } from "@/lib/citadely-db";
import { fetchBusinessAccessState, type BusinessAccessState } from "@/lib/business-access";
import { insforge } from "@/lib/insforge";
import { AlertCircle, LoaderCircle } from "lucide-react";

export type WorkspaceContextValue = {
  business: Business;
  access: BusinessAccessState;
  services: Service[];
  appointments: Appointment[];
  availabilitySlots: ServiceAvailabilitySlot[];
  galleryImages: BusinessGalleryImage[];
  faqs: BusinessFaq[];
  userEmail: string;
  error: string | null;
  refresh: () => Promise<void>;
  /** Appointments and slots are loaded from HISTORY_WINDOW_DAYS ago onward; call this to see further back. */
  ensureHistoryFrom: (from: Date) => Promise<void>;
  signOut: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
const PAGE_SIZE = 500;
// Past appointments grow without bound, so only recent history is loaded up front (everything from here on,
// including all future appointments, which the slot occupancy depends on). 45 days covers the current month.
const HISTORY_WINDOW_DAYS = 45;
const APPOINTMENT_SELECT = "*, clients(name,email,phone), services(name,duration_minutes,price_cents)";
const SLOT_SELECT = "id,business_id,service_id,starts_at,ends_at,is_active,capacity";

function getHistoryStart() {
  return new Date(Date.now() - HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

// Loads every row of a query in pages of PAGE_SIZE, within [from, to) on starts_at.
async function loadRange<T>(table: "appointments" | "service_availability_slots", businessId: string, from: string, to?: string): Promise<T[]> {
  const rows: T[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = insforge.database
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

function mergeById<T extends { id?: string | null }>(current: T[], incoming: T[]) {
  const known = new Set(current.map((row) => row.id));
  return [...incoming.filter((row) => !known.has(row.id)), ...current];
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace debe usarse dentro de WorkspaceProvider");
  return value;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [business, setBusiness] = useState<Business | null>(null);
  const [access, setAccess] = useState<BusinessAccessState | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [availabilitySlots, setAvailabilitySlots] = useState<ServiceAvailabilitySlot[]>([]);
  const [galleryImages, setGalleryImages] = useState<BusinessGalleryImage[]>([]);
  const [faqs, setFaqs] = useState<BusinessFaq[]>([]);
  // Start of the loaded appointment/slot window; moves earlier when the agenda navigates to the past.
  const [historyStart, setHistoryStart] = useState<string | null>(null);

  async function loadBusinessData(businessId: string) {
    const windowStart = historyStart ?? getHistoryStart();
    setHistoryStart(windowStart);
    const [accessState, servicesResult, appointmentRows, availabilityRows, galleryResult, faqResult] = await Promise.all([
      fetchBusinessAccessState(insforge, businessId),
      insforge.database.from("services").select("*").eq("business_id", businessId).order("created_at", { ascending: false }),
      loadRange<Appointment>("appointments", businessId, windowStart),
      loadRange<ServiceAvailabilitySlot>("service_availability_slots", businessId, windowStart),
      insforge.database
        .from("business_gallery_images")
        .select("id,business_id,image_url,image_key,sort_order")
        .eq("business_id", businessId)
        .order("sort_order", { ascending: true })
        .limit(10),
      insforge.database
        .from("business_faqs")
        .select("id,business_id,question,answer,sort_order")
        .eq("business_id", businessId)
        .order("sort_order", { ascending: true })
        .limit(10),
    ]);

    const workspaceError = servicesResult.error ?? galleryResult.error ?? faqResult.error;
    if (workspaceError) throw new Error(getErrorMessage(workspaceError));

    setAccess(accessState);
    setServices((servicesResult.data ?? []) as Service[]);
    setAppointments(appointmentRows);
    setAvailabilitySlots(availabilityRows);
    setGalleryImages((galleryResult.data ?? []) as BusinessGalleryImage[]);
    setFaqs((faqResult.data ?? []) as BusinessFaq[]);
  }

  async function loadWorkspace() {
    setError(null);
    const { data } = await insforge.auth.getCurrentUser();

    if (!data.user) {
      router.replace("/login");
      return;
    }

    const actualPath = getPostAuthPath(data.user);
    if (actualPath !== "/negocio") {
      router.replace(actualPath);
      return;
    }

    setUserEmail(data.user.email ?? "");
    const { data: businessData, error: businessError } = await insforge.database
      .from("businesses")
      .select("*")
      .eq("owner_id", data.user.id)
      .maybeSingle();

    if (businessError) throw new Error(getErrorMessage(businessError));

    // Sin negocio no hay panel: el onboarding es quien lo crea.
    if (!businessData) {
      router.replace("/onboarding");
      return;
    }
    const currentBusiness = businessData as Business;
    setBusiness(currentBusiness);
    await loadBusinessData(currentBusiness.id);
  }

  async function refresh() {
    if (!business) return loadWorkspace();
    setError(null);
    try {
      const { data: refreshedBusiness, error: businessError } = await insforge.database
        .from("businesses")
        .select("*")
        .eq("id", business.id)
        .single();
      if (businessError || !refreshedBusiness) throw new Error(getErrorMessage(businessError));
      setBusiness(refreshedBusiness as Business);
      await loadBusinessData(business.id);
    } catch (refreshError) {
      setError(getErrorMessage(refreshError));
    }
  }

  async function ensureHistoryFrom(from: Date) {
    if (!business || !historyStart || from.getTime() >= new Date(historyStart).getTime()) return;
    // Se pide un mes más atrás de lo necesario para no consultar semana a semana al navegar.
    const nextStart = new Date(from.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [olderAppointments, olderSlots] = await Promise.all([
      loadRange<Appointment>("appointments", business.id, nextStart, historyStart),
      loadRange<ServiceAvailabilitySlot>("service_availability_slots", business.id, nextStart, historyStart),
    ]);
    setHistoryStart(nextStart);
    setAppointments((current) => mergeById(current, olderAppointments));
    setAvailabilitySlots((current) => mergeById(current, olderSlots));
  }

  useEffect(() => {
    // La carga inicial sincroniza el proveedor persistente con la sesión remota.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadWorkspace()
      .catch((workspaceError) => setError(getErrorMessage(workspaceError)))
      .finally(() => setLoading(false));
    // El workspace se carga una sola vez y se conserva en el layout anidado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signOut() {
    await insforge.auth.signOut();
    router.push("/login");
  }

  const value: WorkspaceContextValue | null = business && access ? ({
    business,
    access,
    services,
    appointments,
    availabilitySlots,
    galleryImages,
    faqs,
    userEmail,
    error,
    refresh,
    ensureHistoryFrom,
    signOut,
  }) : null;

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-canvas px-6">
        <div className="flex items-center gap-3 text-sm font-semibold text-ink-soft" role="status">
          <LoaderCircle aria-hidden="true" className="animate-spin text-primary" size={20} />
          Preparando tu central de turnos…
        </div>
      </main>
    );
  }

  if (!value) {
    return (
      <main className="grid min-h-screen place-items-center bg-canvas px-6">
        <div className="max-w-md border border-danger-line bg-white p-6 text-center shadow-raised">
          <AlertCircle aria-hidden="true" className="mx-auto text-danger" size={28} />
          <h1 className="mt-4 text-xl font-semibold">No pudimos cargar tu espacio</h1>
          <p className="mt-2 text-sm leading-6 text-ink-soft">{error ?? "Volvé a iniciar sesión para continuar."}</p>
        </div>
      </main>
    );
  }

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
