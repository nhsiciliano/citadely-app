"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getCitadelyProfile, getErrorMessage, getPostAuthPath, slugifyBusinessName } from "@/lib/auth";
import type { Appointment, Business, Client, Service, ServiceAvailabilitySlot } from "@/lib/citadely-db";
import { insforge } from "@/lib/insforge";
import { saveBusinessNotificationEmail } from "@/lib/business-notifications";
import { AlertCircle, LoaderCircle } from "lucide-react";

export type WorkspaceContextValue = {
  business: Business;
  services: Service[];
  clients: Client[];
  appointments: Appointment[];
  availabilitySlots: ServiceAvailabilitySlot[];
  userEmail: string;
  error: string | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

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
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [availabilitySlots, setAvailabilitySlots] = useState<ServiceAvailabilitySlot[]>([]);

  async function loadBusinessData(businessId: string) {
    const [servicesResult, clientsResult, appointmentsResult, availabilityResult] = await Promise.all([
      insforge.database.from("services").select("*").eq("business_id", businessId).order("created_at", { ascending: false }),
      insforge.database.from("clients").select("*").eq("business_id", businessId).order("created_at", { ascending: false }),
      insforge.database
        .from("appointments")
        .select("*, clients(name,email,phone), services(name,duration_minutes,price_cents)")
        .eq("business_id", businessId)
        .order("starts_at", { ascending: true }),
      insforge.database
        .from("service_availability_slots")
        .select("*")
        .eq("business_id", businessId)
        .order("starts_at", { ascending: true }),
    ]);

    const workspaceError = servicesResult.error ?? clientsResult.error ?? appointmentsResult.error ?? availabilityResult.error;
    if (workspaceError) throw new Error(getErrorMessage(workspaceError));

    setServices((servicesResult.data ?? []) as Service[]);
    setClients((clientsResult.data ?? []) as Client[]);
    setAppointments((appointmentsResult.data ?? []) as Appointment[]);
    setAvailabilitySlots((availabilityResult.data ?? []) as ServiceAvailabilitySlot[]);
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

    let currentBusiness = businessData as Business | null;
    if (!currentBusiness) {
      const profile = getCitadelyProfile(data.user);
      const fallbackName = profile.business_name ?? "Mi negocio";
      const { data: created, error: createError } = await insforge.database
        .from("businesses")
        .insert([{
          owner_id: data.user.id,
          name: fallbackName,
          slug: profile.business_slug ?? slugifyBusinessName(fallbackName),
          category: profile.business_category ?? "otros",
        }])
        .select("*")
        .single();

      if (createError || !created) throw new Error(getErrorMessage(createError) || "No se pudo crear el negocio.");
      currentBusiness = created as Business;
    }

    setBusiness(currentBusiness);
    await saveBusinessNotificationEmail(currentBusiness.id, data.user.email);
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

  const value: WorkspaceContextValue | null = business ? ({
    business,
    services,
    clients,
    appointments,
    availabilitySlots,
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
