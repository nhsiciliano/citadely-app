"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { signOutAction } from "@/app/auth/actions";
import { getErrorMessage } from "@/lib/auth";
import type { BusinessAccessState } from "@/lib/business-access";
import type { Appointment, Business, BusinessFaq, BusinessGalleryImage, Service, ServiceAvailabilitySlot } from "@/lib/citadely-db";
import { insforge } from "@/lib/insforge";
import { getBusinessPublicUrl } from "@/lib/urls";
import { useLiveAppointments } from "./use-live-appointments";
import { loadRange, loadWorkspaceData, type InitialWorkspace } from "@/lib/workspace-data";

export type WorkspaceContextValue = {
  business: Business;
  access: BusinessAccessState;
  services: Service[];
  appointments: Appointment[];
  availabilitySlots: ServiceAvailabilitySlot[];
  galleryImages: BusinessGalleryImage[];
  faqs: BusinessFaq[];
  userEmail: string;
  /** URL pública del negocio, igual en servidor y navegador. */
  publicUrl: string;
  error: string | null;
  refresh: () => Promise<void>;
  /** Appointments and slots are loaded from HISTORY_WINDOW_DAYS ago onward; call this to see further back. */
  ensureHistoryFrom: (from: Date) => Promise<void>;
  signOut: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function mergeById<T extends { id?: string | null }>(current: T[], incoming: T[]) {
  const known = new Set(current.map((row) => row.id));
  return [...incoming.filter((row) => !known.has(row.id)), ...current];
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace debe usarse dentro de WorkspaceProvider");
  return value;
}

// El layout de /negocio autentica y carga el primer dataset en el servidor; el provider arranca con esos
// datos (sin pantalla de carga ni redirects en el cliente) y solo vuelve a consultar en refresh e historial.
export function WorkspaceProvider({ children, initial }: { children: ReactNode; initial: InitialWorkspace }) {
  const [error, setError] = useState<string | null>(null);
  const [business, setBusiness] = useState<Business>(initial.business);
  const [access, setAccess] = useState<BusinessAccessState>(initial.access);
  const [services, setServices] = useState<Service[]>(initial.services);
  const [appointments, setAppointments] = useState<Appointment[]>(initial.appointments);
  const [availabilitySlots, setAvailabilitySlots] = useState<ServiceAvailabilitySlot[]>(initial.availabilitySlots);
  const [galleryImages, setGalleryImages] = useState<BusinessGalleryImage[]>(initial.galleryImages);
  const [faqs, setFaqs] = useState<BusinessFaq[]>(initial.faqs);
  // Start of the loaded appointment/slot window; moves earlier when the agenda navigates to the past.
  const [historyStart, setHistoryStart] = useState(initial.historyStart);
  const userEmail = initial.userEmail;

  // Los turnos nuevos, cancelados o modificados por clientes o por el cron aparecen sin recargar.
  useLiveAppointments({ businessId: business.id, historyStart, onAppointments: setAppointments });

  async function loadBusinessData(businessId: string) {
    const data = await loadWorkspaceData(insforge, businessId, historyStart);
    setAccess(data.access);
    setServices(data.services);
    setAppointments(data.appointments);
    setAvailabilitySlots(data.availabilitySlots);
    setGalleryImages(data.galleryImages);
    setFaqs(data.faqs);
  }

  async function refresh() {
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
    if (from.getTime() >= new Date(historyStart).getTime()) return;
    // Se pide un mes más atrás de lo necesario para no consultar semana a semana al navegar.
    const nextStart = new Date(from.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [olderAppointments, olderSlots] = await Promise.all([
      loadRange<Appointment>(insforge, "appointments", business.id, nextStart, historyStart),
      loadRange<ServiceAvailabilitySlot>(insforge, "service_availability_slots", business.id, nextStart, historyStart),
    ]);
    setHistoryStart(nextStart);
    setAppointments((current) => mergeById(current, olderAppointments));
    setAvailabilitySlots((current) => mergeById(current, olderSlots));
  }

  async function signOut() {
    const result = await signOutAction();
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // Navegación completa: descarta el estado del panel y el token en memoria del cliente.
    window.location.assign("/login");
  }

  const value: WorkspaceContextValue = {
    business,
    access,
    services,
    appointments,
    availabilitySlots,
    galleryImages,
    faqs,
    userEmail,
    publicUrl: getBusinessPublicUrl(business.slug, initial.publicOrigin),
    error,
    refresh,
    ensureHistoryFrom,
    signOut,
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
