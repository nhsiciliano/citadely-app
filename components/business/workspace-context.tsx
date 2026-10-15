"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getErrorMessage, getPostAuthPath } from "@/lib/auth";
import type { Appointment, Business, BusinessFaq, BusinessGalleryImage, Client, Service, ServiceAvailabilitySlot } from "@/lib/citadely-db";
import { fetchBusinessAccessState, type BusinessAccessState } from "@/lib/business-access";
import { insforge } from "@/lib/insforge";
import { AlertCircle, LoaderCircle } from "lucide-react";

export type WorkspaceContextValue = {
  business: Business;
  access: BusinessAccessState;
  services: Service[];
  clients: Client[];
  appointments: Appointment[];
  availabilitySlots: ServiceAvailabilitySlot[];
  galleryImages: BusinessGalleryImage[];
  faqs: BusinessFaq[];
  userEmail: string;
  error: string | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
const AVAILABILITY_PAGE_SIZE = 500;

async function loadAvailabilitySlots(businessId: string): Promise<ServiceAvailabilitySlot[]> {
  const slots: ServiceAvailabilitySlot[] = [];

  for (let offset = 0; ; offset += AVAILABILITY_PAGE_SIZE) {
    const { data, error } = await insforge.database
      .from("service_availability_slots")
      .select("id,business_id,service_id,starts_at,ends_at,is_active,capacity")
      .eq("business_id", businessId)
      .order("starts_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + AVAILABILITY_PAGE_SIZE - 1);

    if (error) throw new Error(getErrorMessage(error));
    const page = (data ?? []) as ServiceAvailabilitySlot[];
    slots.push(...page);
    if (page.length < AVAILABILITY_PAGE_SIZE) return slots;
  }
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
  const [clients, setClients] = useState<Client[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [availabilitySlots, setAvailabilitySlots] = useState<ServiceAvailabilitySlot[]>([]);
  const [galleryImages, setGalleryImages] = useState<BusinessGalleryImage[]>([]);
  const [faqs, setFaqs] = useState<BusinessFaq[]>([]);

  async function loadBusinessData(businessId: string) {
    const [accessState, servicesResult, clientsResult, appointmentsResult, availabilityRows, galleryResult, faqResult] = await Promise.all([
      fetchBusinessAccessState(insforge, businessId),
      insforge.database.from("services").select("*").eq("business_id", businessId).order("created_at", { ascending: false }),
      insforge.database.from("clients").select("*").eq("business_id", businessId).order("created_at", { ascending: false }),
      insforge.database
        .from("appointments")
        .select("*, clients(name,email,phone), services(name,duration_minutes,price_cents)")
        .eq("business_id", businessId)
        .order("starts_at", { ascending: true }),
      loadAvailabilitySlots(businessId),
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

    const workspaceError = servicesResult.error ?? clientsResult.error ?? appointmentsResult.error ?? galleryResult.error ?? faqResult.error;
    if (workspaceError) throw new Error(getErrorMessage(workspaceError));

    setAccess(accessState);
    setServices((servicesResult.data ?? []) as Service[]);
    setClients((clientsResult.data ?? []) as Client[]);
    setAppointments((appointmentsResult.data ?? []) as Appointment[]);
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
    clients,
    appointments,
    availabilitySlots,
    galleryImages,
    faqs,
    userEmail,
    error,
    refresh,
    signOut,
  }) : null;

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--color-canvas)] px-6">
        <div className="flex items-center gap-3 text-sm font-semibold text-[var(--color-ink-soft)]" role="status">
          <LoaderCircle aria-hidden="true" className="animate-spin text-[var(--color-primary)]" size={20} />
          Preparando tu central de turnos…
        </div>
      </main>
    );
  }

  if (!value) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--color-canvas)] px-6">
        <div className="max-w-md border border-[var(--color-danger-line)] bg-white p-6 text-center shadow-[var(--shadow-raised)]">
          <AlertCircle aria-hidden="true" className="mx-auto text-[var(--color-danger)]" size={28} />
          <h1 className="mt-4 text-xl font-semibold">No pudimos cargar tu espacio</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--color-ink-soft)]">{error ?? "Volvé a iniciar sesión para continuar."}</p>
        </div>
      </main>
    );
  }

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
