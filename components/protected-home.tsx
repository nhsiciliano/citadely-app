"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { getCitadelyProfile, getErrorMessage, getPostAuthPath, slugifyBusinessName } from "@/lib/auth";
import {
  calculateStats,
  centsFromCurrency,
  formatAppointmentTime,
  formatCurrency,
  getSubscriptionState,
  type Appointment,
  type Business,
  type Client,
  type Service,
  type ServiceAvailabilitySlot,
} from "@/lib/citadely-db";
import { insforge } from "@/lib/insforge";
import { getBusinessPublicUrl } from "@/lib/urls";
import { saveBusinessNotificationEmail } from "@/lib/business-notifications";
import { Field, FormMessage, LogoMark, SubmitButton } from "@/components/ui";

export function BusinessHome() {
  return <ProtectedHome />;
}

function ProtectedHome() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [business, setBusiness] = useState<Business | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [availabilitySlots, setAvailabilitySlots] = useState<ServiceAvailabilitySlot[]>([]);

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

    if (businessError) {
      setError(getErrorMessage(businessError));
      setLoading(false);
      return;
    }

    if (!businessData) {
      const profile = getCitadelyProfile(data.user);
      const fallbackName = profile.business_name ?? "Mi negocio";
      const payload = {
        owner_id: data.user.id,
        name: fallbackName,
        slug: profile.business_slug ?? slugifyBusinessName(fallbackName),
        category: profile.business_category ?? "otros",
      };
      const { data: created, error: createError } = await insforge.database
        .from("businesses")
        .insert([payload])
        .select("*")
        .single();

      if (createError) {
        setError(getErrorMessage(createError));
        setLoading(false);
        return;
      }

      setBusiness(created as Business);
      await saveBusinessNotificationEmail((created as Business).id, data.user.email);
      await loadBusinessData((created as Business).id);
      setLoading(false);
      return;
    }

    setBusiness(businessData as Business);
    await saveBusinessNotificationEmail((businessData as Business).id, data.user.email);
    await loadBusinessData((businessData as Business).id);
    setLoading(false);
  }

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

    if (servicesResult.error || clientsResult.error || appointmentsResult.error || availabilityResult.error) {
      setError(getErrorMessage(servicesResult.error ?? clientsResult.error ?? appointmentsResult.error ?? availabilityResult.error));
      return;
    }

    setServices((servicesResult.data ?? []) as Service[]);
    setClients((clientsResult.data ?? []) as Client[]);
    setAppointments((appointmentsResult.data ?? []) as Appointment[]);
    setAvailabilitySlots((availabilityResult.data ?? []) as ServiceAvailabilitySlot[]);
  }

  useEffect(() => {
    void Promise.resolve().then(loadWorkspace);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signOut() {
    await insforge.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--agenda-paper)] px-5">
        <p className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-5 py-3 text-sm font-semibold text-[var(--ink-soft)]">
          Cargando agenda...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--agenda-paper)] px-5 py-6 sm:px-8">
      <div className="mx-auto grid max-w-7xl gap-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm sm:p-5">
          <LogoMark />
          <div className="flex items-center gap-3">
            <span className="hidden text-sm font-medium text-[var(--ink-soft)] sm:inline">{userEmail}</span>
            <button className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold hover:border-[var(--danger)] hover:text-[var(--danger)]" onClick={signOut} type="button">
              Salir
            </button>
          </div>
        </header>

        {error ? <FormMessage type="error">{error}</FormMessage> : null}
        {business ? (
          <BusinessWorkspace
            appointments={appointments}
            business={business}
            clients={clients}
            onChanged={loadWorkspace}
            availabilitySlots={availabilitySlots}
            services={services}
            userEmail={userEmail}
          />
        ) : null}
      </div>
    </main>
  );
}

function BusinessWorkspace({
  business,
  services,
  clients,
  appointments,
  onChanged,
  userEmail,
  availabilitySlots,
}: {
  business: Business;
  services: Service[];
  clients: Client[];
  appointments: Appointment[];
  onChanged: () => Promise<void>;
  userEmail: string;
  availabilitySlots: ServiceAvailabilitySlot[];
}) {
  const stats = calculateStats(appointments, services);
  const subscription = getSubscriptionState(business);
  const publicUrl = getBusinessPublicUrl(business.slug);

  return (
    <section className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm">
        <p className="px-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">{business.name}</p>
        <nav className="mt-4 grid gap-2 text-sm font-semibold">
          {["Dashboard", "Agenda", "Servicios", "Clientes"].map((item) => (
            <a className="rounded-2xl px-3 py-3 text-[var(--ink-soft)] hover:bg-[var(--reception-soft)] hover:text-[var(--reception)]" href={`#${item.toLowerCase()}`} key={item}>
              {item}
            </a>
          ))}
        </nav>
      </aside>

      <div className="grid gap-6">
        <section id="dashboard" className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--terracotta)]">Dashboard conectado</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] sm:text-5xl">{business.name}</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--ink-soft)]">
                Gestion inicial de servicios, clientes y citas sobre InsForge DB con RLS por propietario.
              </p>
              <p className="mt-3 text-sm font-semibold text-[var(--reception)]">{publicUrl}</p>
            </div>
            <Link className="rounded-full bg-[var(--reception)] px-5 py-3 text-sm font-semibold text-white hover:bg-[#215d4d]" href={publicUrl}>
              Ver pagina publica
            </Link>
          </div>
        </section>

        <BillingPanel business={business} onChanged={onChanged} subscription={subscription} userEmail={userEmail} />

        <section className="grid gap-4 md:grid-cols-4">
          {[
            ["Citas de hoy", String(stats.todayAppointments), "agenda operativa"],
            ["Proximas", String(stats.upcomingAppointments), "desde ahora"],
            ["Ingresos del mes", formatCurrency(stats.monthlyRevenueCents, business.currency), "por servicios agendados"],
            ["Ocupacion", `${stats.occupancy}%`, "base 8 horas/dia"],
          ].map(([label, value, hint]) => (
            <article className="rounded-[1.5rem] border border-[var(--line)] bg-[var(--surface-raised)] p-5 shadow-sm" key={label}>
              <p className="text-sm font-semibold text-[var(--ink-soft)]">{label}</p>
              <p className="number-tabular mt-4 text-3xl font-semibold tracking-[-0.05em]">{value}</p>
              <p className="mt-2 text-sm text-[var(--ink-muted)]">{hint}</p>
            </article>
          ))}
        </section>

        <PaymentSettingsPanel business={business} disabled={!subscription.hasAccess} onChanged={onChanged} />
        <ServicesPanel availabilitySlots={availabilitySlots} business={business} disabled={!subscription.hasAccess} onChanged={onChanged} services={services} />
        <ClientsAndAgendaPanel appointments={appointments} business={business} clients={clients} disabled={!subscription.hasAccess} onChanged={onChanged} services={services} />
      </div>
    </section>
  );
}

function BillingPanel({
  business,
  subscription,
  userEmail,
  onChanged,
}: {
  business: Business;
  subscription: ReturnType<typeof getSubscriptionState>;
  userEmail: string;
  onChanged: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function startSubscription() {
    setPending(true);
    setMessage(null);

    const response = await fetch("/api/mercadopago/subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId: business.id, payerEmail: userEmail }),
    });
    const data = (await response.json()) as { externalId?: string; checkoutUrl?: string; error?: string };

    if (!response.ok || !data.externalId || !data.checkoutUrl) {
      setPending(false);
      setMessage(data.error ?? "No se pudo iniciar la suscripcion mensual.");
      return;
    }

    const { error } = await insforge.database.rpc("set_business_subscription_checkout", {
      p_business_id: business.id,
      p_external_id: data.externalId,
      p_checkout_url: data.checkoutUrl,
    });

    if (error) {
      setPending(false);
      setMessage(getErrorMessage(error));
      return;
    }

    await onChanged();
    window.location.href = data.checkoutUrl;
  }

  return (
    <section className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--clinical)]">Plan Citadely</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">
            {subscription.hasAccess ? "Tu tienda esta activa" : "Tu prueba gratuita finalizo"}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--ink-soft)]">
            {subscription.isTrialing
              ? `Tenes ${subscription.trialDaysLeft} dia${subscription.trialDaysLeft === 1 ? "" : "s"} de uso gratuito sin restricciones. Luego el plan cuesta $15000 ARS por mes.`
              : business.subscription_status === "active"
                ? "Plan mensual activo por $15000 ARS. Tu tienda puede seguir recibiendo reservas."
                : "Activa la suscripcion mensual automatica de $15000 ARS para volver a crear servicios y recibir reservas."}
          </p>
        </div>
        {business.subscription_status !== "active" ? (
          <button
            className="rounded-full bg-[var(--reception)] px-5 py-3 text-sm font-semibold text-white hover:bg-[#215d4d] disabled:opacity-60"
            disabled={pending}
            onClick={startSubscription}
            type="button"
          >
            {pending ? "Abriendo Mercado Pago..." : "Activar plan mensual"}
          </button>
        ) : null}
      </div>
      {message ? <div className="mt-4"><FormMessage type="error">{message}</FormMessage></div> : null}
    </section>
  );
}

function PaymentSettingsPanel({ business, disabled, onChanged }: { business: Business; disabled: boolean; onChanged: () => Promise<void> }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function savePaymentSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setPending(true);
    setMessage(null);

    const { error } = await insforge.database
      .from("businesses")
      .update({
        payment_alias: String(form.get("payment_alias") ?? ""),
        payment_cbu: String(form.get("payment_cbu") ?? ""),
        payment_instructions: String(form.get("payment_instructions") ?? ""),
      })
      .eq("id", business.id);

    setPending(false);

    if (error) {
      setMessage(getErrorMessage(error));
      return;
    }

    setMessage("Datos de transferencia guardados.");
    await onChanged();
  }

  return (
    <section className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm sm:p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--clinical)]">Señas por transferencia</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">Alias, CBU/CVU e instrucciones</h2>
      <form className="mt-5 grid gap-3 sm:grid-cols-2" onSubmit={savePaymentSettings}>
        <Field defaultValue={business.payment_alias ?? ""} label="Alias" name="payment_alias" placeholder="mi.alias.mp" required={false} />
        <Field defaultValue={business.payment_cbu ?? ""} label="CBU/CVU" name="payment_cbu" placeholder="00000031000..." required={false} />
        <div className="sm:col-span-2">
          <Field defaultValue={business.payment_instructions ?? ""} label="Instrucciones de pago" name="payment_instructions" placeholder="Enviar comprobante por WhatsApp luego de reservar" required={false} />
        </div>
        <div className="sm:col-span-2">
          <SubmitButton disabled={disabled} pending={pending}>Guardar datos de seña</SubmitButton>
          {message ? <div className="mt-3"><FormMessage type={message.includes("guardados") ? "success" : "error"}>{message}</FormMessage></div> : null}
        </div>
      </form>
    </section>
  );
}

const MONTH_FORMATTER = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" });
const DAY_FORMATTER = new Intl.DateTimeFormat("es-AR", { day: "2-digit" });
const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("es-AR", { weekday: "short" });

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function buildDateTime(dateKey: string, time: string) {
  return new Date(`${dateKey}T${time}:00`);
}

function buildMonthDays(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const leadingBlanks = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

  return [
    ...Array.from({ length: leadingBlanks }, (_, index) => ({ key: `blank-start-${index}`, blank: true as const })),
    ...Array.from({ length: daysInMonth }, (_, index) => {
      const date = new Date(year, month - 1, index + 1);
      return {
        blank: false as const,
        date,
        dateKey: getDateKey(date),
        dayNumber: index + 1,
        weekday: WEEKDAY_FORMATTER.format(date),
      };
    }),
  ];
}

function getMonthOptions() {
  const today = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() + index, 1);
    return {
      key: getMonthKey(date),
      label: MONTH_FORMATTER.format(date),
    };
  });
}

function normalizeTime(value: string) {
  return value.slice(0, 5);
}

function buildSlotRows(dateTimes: Record<string, string[]>, businessId: string, serviceId: string, durationMinutes: number) {
  return Object.entries(dateTimes).flatMap(([dateKey, times]) =>
    times.map((time) => {
      const startsAt = buildDateTime(dateKey, time);
      const endsAt = new Date(startsAt.getTime() + durationMinutes * 60000);
      return {
        business_id: businessId,
        service_id: serviceId,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        is_active: true,
      };
    }),
  );
}

function serviceMonthSlotCount(slots: ServiceAvailabilitySlot[], serviceId: string, monthKey: string) {
  return slots.filter((slot) => {
    const startsAt = new Date(slot.starts_at);
    return slot.service_id === serviceId && slot.is_active && getMonthKey(startsAt) === monthKey;
  }).length;
}

function ServicesPanel({
  business,
  services,
  availabilitySlots,
  disabled,
  onChanged,
}: {
  business: Business;
  services: Service[];
  availabilitySlots: ServiceAvailabilitySlot[];
  disabled: boolean;
  onChanged: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const monthOptions = useMemo(() => getMonthOptions(), []);
  const [monthKey, setMonthKey] = useState(monthOptions[0]?.key ?? getMonthKey(new Date()));
  const [selectedDateKey, setSelectedDateKey] = useState("");
  const [draftTime, setDraftTime] = useState("");
  const [dateTimes, setDateTimes] = useState<Record<string, string[]>>({});
  const monthDays = useMemo(() => buildMonthDays(monthKey), [monthKey]);
  const selectedDateTimes = selectedDateKey ? (dateTimes[selectedDateKey] ?? []) : [];
  const totalDraftSlots = Object.values(dateTimes).reduce((total, times) => total + times.length, 0);

  async function addService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    const formElement = event.currentTarget;
    setPending(true);
    setMessage(null);
    const form = new FormData(formElement);
    const priceCents = centsFromCurrency(form.get("price"));
    const depositType = String(form.get("deposit_type")) as Service["deposit_type"];
    const depositValueCents = depositType === "full" ? priceCents : centsFromCurrency(form.get("deposit_value"));
    const durationMinutes = Number(form.get("duration_minutes") ?? 30);
    const slotRowsForValidation = buildSlotRows(dateTimes, business.id, "pending", durationMinutes);

    if (slotRowsForValidation.length === 0) {
      setPending(false);
      setMessage("Agrega al menos un dia y horario para publicar este servicio.");
      return;
    }

    const { data: createdService, error } = await insforge.database.from("services").insert([
      {
        business_id: business.id,
        name: String(form.get("name") ?? ""),
        description: String(form.get("description") ?? ""),
        image_url: String(form.get("image_url") ?? ""),
        duration_minutes: durationMinutes,
        price_cents: priceCents,
        requires_payment: depositType !== "free",
        deposit_type: depositType,
        deposit_value_cents: depositValueCents,
      },
    ]).select("*").single();

    if (error || !createdService) {
      setPending(false);
      setMessage(getErrorMessage(error) || "No se pudo crear el servicio.");
      return;
    }

    const service = createdService as Service;
    const slotRows = buildSlotRows(dateTimes, business.id, service.id, durationMinutes);
    const { error: slotsError } = await insforge.database.from("service_availability_slots").insert(slotRows);

    if (slotsError) {
      await insforge.database.from("services").update({ is_active: false }).eq("id", service.id);
      setPending(false);
      setMessage(`El servicio se creo pausado porque no se pudo guardar la disponibilidad: ${getErrorMessage(slotsError)}`);
      await onChanged();
      return;
    }

    setPending(false);
    setMessage("Servicio y disponibilidad mensual guardados.");
    formElement.reset();
    setSelectedDateKey("");
    setDraftTime("");
    setDateTimes({});
    await onChanged();
  }

  async function toggleService(service: Service) {
    if (disabled) return;
    await insforge.database.from("services").update({ is_active: !service.is_active }).eq("id", service.id);
    await onChanged();
  }

  function addDraftTime() {
    if (!selectedDateKey) {
      setMessage("Selecciona un dia del mes antes de agregar horarios.");
      return;
    }

    const time = normalizeTime(draftTime);
    if (!time) return;

    setDateTimes((current) => {
      const currentTimes = current[selectedDateKey] ?? [];
      if (currentTimes.includes(time)) return current;
      return {
        ...current,
        [selectedDateKey]: [...currentTimes, time].sort(),
      };
    });
    setDraftTime("");
  }

  function removeDraftTime(dateKey: string, time: string) {
    setDateTimes((current) => {
      const nextTimes = (current[dateKey] ?? []).filter((item) => item !== time);
      const next = { ...current };
      if (nextTimes.length === 0) delete next[dateKey];
      else next[dateKey] = nextTimes;
      return next;
    });
  }

  return (
    <section id="servicios" className="grid gap-5 rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--terracotta)]">Servicios</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">Servicio y agenda mensual</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--ink-soft)]">
            Crea el servicio y publica dias concretos del mes con una o varias horas por dia.
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-white/60 px-4 py-3 text-sm font-semibold text-[var(--ink-soft)]">
          {totalDraftSlots} turnos preparados
        </div>
      </div>

      <form className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]" onSubmit={addService}>
        <div className="grid content-start gap-3 rounded-[1.5rem] border border-[var(--line)] bg-white/45 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">Datos del servicio</p>
          <Field label="Nombre" name="name" placeholder="Consulta psicologica" />
          <Field label="Descripción detallada" name="description" placeholder="Que incluye, preparacion previa o indicaciones para el cliente" required={false} />
          <Field label="Imagen del servicio" name="image_url" placeholder="https://..." type="url" required={false} />
          <Field label="Duracion en minutos" name="duration_minutes" type="number" defaultValue="30" />
          <Field label="Precio" name="price" type="number" defaultValue="0" />
          <label className="grid gap-2 text-sm font-semibold text-[var(--ink)]">
            Cobro al reservar
            <select className="min-h-12 rounded-2xl border border-[var(--line)] bg-white/70 px-4 text-base font-medium" name="deposit_type">
              <option value="free">Reserva gratuita</option>
              <option value="deposit">Seña configurable</option>
              <option value="full">Seña del 100%</option>
            </select>
          </label>
          <Field label="Monto de seña" name="deposit_value" type="number" defaultValue="0" required={false} />
          <SubmitButton disabled={disabled} pending={pending}>Agregar servicio</SubmitButton>
          {disabled ? <FormMessage type="error">Activa el plan mensual para crear o editar servicios.</FormMessage> : null}
          {message ? <FormMessage type={message.includes("guardad") ? "success" : "error"}>{message}</FormMessage> : null}
        </div>

        <div className="grid gap-4 rounded-[1.5rem] border border-[var(--line)] bg-white/45 p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">Disponibilidad</p>
              <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em]">Calendario mensual</h3>
            </div>
            <label className="grid gap-2 text-sm font-semibold text-[var(--ink)]">
              Mes
              <select
                className="min-h-11 rounded-2xl border border-[var(--line)] bg-white/80 px-4 text-sm font-semibold capitalize"
                onChange={(event) => {
                  setMonthKey(event.target.value);
                  setSelectedDateKey("");
                }}
                value={monthKey}
              >
                {monthOptions.map((option) => (
                  <option key={option.key} value={option.key}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-[var(--ink-muted)]">
            {["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"].map((weekday) => <span className="py-2" key={weekday}>{weekday}</span>)}
            {monthDays.map((day) => {
              if (day.blank) return <span key={day.key} />;
              const slotCount = dateTimes[day.dateKey]?.length ?? 0;
              const selected = selectedDateKey === day.dateKey;
              return (
                <button
                  className={`min-h-16 rounded-2xl border p-2 text-left transition ${
                    selected
                      ? "border-[var(--reception)] bg-[var(--reception)] text-white"
                      : slotCount > 0
                        ? "border-[var(--reception)] bg-[var(--reception-soft)] text-[var(--reception)]"
                        : "border-[var(--line)] bg-white/70 text-[var(--ink)] hover:border-[var(--line-strong)]"
                  }`}
                  key={day.dateKey}
                  onClick={() => setSelectedDateKey(day.dateKey)}
                  type="button"
                >
                  <span className="block text-base font-semibold">{DAY_FORMATTER.format(day.date)}</span>
                  <span className="mt-1 block text-[0.68rem] font-semibold uppercase opacity-70">{day.weekday}</span>
                  {slotCount > 0 ? <span className="mt-1 block text-[0.68rem] font-semibold">{slotCount} turnos</span> : null}
                </button>
              );
            })}
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-white/70 p-4">
            <p className="text-sm font-semibold text-[var(--ink)]">
              {selectedDateKey ? `Horarios para ${selectedDateKey}` : "Selecciona un dia para agregar horarios"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                className="min-h-11 rounded-2xl border border-[var(--line)] bg-white px-4 text-base font-medium"
                disabled={!selectedDateKey}
                onChange={(event) => setDraftTime(event.target.value)}
                type="time"
                value={draftTime}
              />
              <button
                className="min-h-11 rounded-full bg-[var(--ink)] px-5 text-sm font-semibold text-white disabled:opacity-50"
                disabled={!selectedDateKey || !draftTime}
                onClick={addDraftTime}
                type="button"
              >
                Agregar hora
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedDateTimes.length === 0 ? (
                <span className="text-sm text-[var(--ink-muted)]">Sin horarios cargados para este dia.</span>
              ) : null}
              {selectedDateTimes.map((time) => (
                <button
                  className="rounded-full border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-[var(--ink-soft)] hover:border-[var(--danger)] hover:text-[var(--danger)]"
                  key={time}
                  onClick={() => removeDraftTime(selectedDateKey, time)}
                  type="button"
                >
                  {time} x
                </button>
              ))}
            </div>
          </div>
        </div>
      </form>

      <div className="grid content-start gap-3">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--terracotta)]">Servicios</p>
        {services.length === 0 ? <EmptyState title="Sin servicios" text="Agrega el primer servicio para comenzar a reservar turnos." /> : null}
        {services.map((service) => (
          <article className="rounded-2xl border border-[var(--line)] bg-white/60 p-4" key={service.id}>
            <div className="flex items-start gap-4">
              {service.image_url ? (
                <div
                  aria-hidden="true"
                  className="h-16 w-16 rounded-2xl bg-cover bg-center"
                  style={{ backgroundImage: `url(${service.image_url})` }}
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--reception-soft)] text-lg font-semibold text-[var(--reception)]">
                  {service.name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div>
                <p className="font-semibold">{service.name}</p>
                <p className="mt-1 text-sm text-[var(--ink-soft)]">{service.duration_minutes} min · {formatCurrency(service.price_cents, business.currency)}</p>
                <p className="mt-1 text-sm text-[var(--ink-muted)]">{service.deposit_type === "free" ? "Reserva gratuita" : service.deposit_type === "full" ? "Seña del 100% por transferencia" : `Seña ${formatCurrency(service.deposit_value_cents, business.currency)} por transferencia`}</p>
                <p className="mt-1 text-sm font-semibold text-[var(--reception)]">
                  {serviceMonthSlotCount(availabilitySlots, service.id, monthKey)} turnos publicados en {monthOptions.find((option) => option.key === monthKey)?.label}
                </p>
              </div>
              <button className="ml-auto rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold" onClick={() => toggleService(service)} type="button">
                {service.is_active ? "Activo" : "Pausado"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ClientsAndAgendaPanel({ business, services, clients, appointments, disabled, onChanged }: { business: Business; services: Service[]; clients: Client[]; appointments: Appointment[]; disabled: boolean; onChanged: () => Promise<void> }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function addClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    const formElement = event.currentTarget;
    setPending(true);
    setMessage(null);
    const form = new FormData(formElement);
    const { error } = await insforge.database.from("clients").insert([
      {
        business_id: business.id,
        name: String(form.get("client_name") ?? ""),
        email: String(form.get("client_email") ?? ""),
        phone: String(form.get("client_phone") ?? ""),
      },
    ]);
    setPending(false);
    if (error) setMessage(getErrorMessage(error));
    else {
      formElement.reset();
      await onChanged();
    }
  }

  async function addAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    const formElement = event.currentTarget;
    setPending(true);
    setMessage(null);
    const form = new FormData(formElement);
    const service = services.find((item) => item.id === form.get("service_id"));
    const startsAt = new Date(String(form.get("starts_at")));
    const endsAt = new Date(startsAt.getTime() + (service?.duration_minutes ?? 30) * 60000);
    const { error } = await insforge.database.from("appointments").insert([
      {
        business_id: business.id,
        client_id: String(form.get("client_id") ?? ""),
        service_id: String(form.get("service_id") ?? ""),
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        status: "confirmed",
        source: "business",
      },
    ]);
    setPending(false);
    if (error) setMessage(getErrorMessage(error));
    else {
      formElement.reset();
      await onChanged();
    }
  }

  async function updateAppointmentStatus(appointment: Appointment, status: Appointment["status"]) {
    if (disabled) return;
    await insforge.database.from("appointments").update({ status }).eq("id", appointment.id);
    await onChanged();
  }

  async function confirmDeposit(appointment: Appointment) {
    if (disabled) return;
    const { error } = await insforge.database.rpc("confirm_appointment_deposit", {
      p_appointment_id: appointment.id,
    });
    if (error) setMessage(getErrorMessage(error));
    else await onChanged();
  }

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div id="clientes" className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm sm:p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--clinical)]">Clientes</p>
        <form className="mt-5 grid gap-3" onSubmit={addClient}>
          <Field label="Nombre" name="client_name" placeholder="Nombre del cliente" />
          <Field label="Email" name="client_email" type="email" required={false} />
          <Field label="Telefono" name="client_phone" required={false} />
          <SubmitButton disabled={disabled} pending={pending}>Agregar cliente</SubmitButton>
        </form>
        <div className="mt-5 grid gap-3">
          {clients.length === 0 ? <EmptyState title="Sin clientes" text="Carga clientes manualmente o desde la reserva publica." /> : null}
          {clients.map((client) => (
            <article className="rounded-2xl border border-[var(--line)] bg-white/60 p-4" key={client.id}>
              <p className="font-semibold">{client.name}</p>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">{client.email || "Sin email"} · {client.phone || "Sin telefono"}</p>
            </article>
          ))}
        </div>
      </div>

      <div id="agenda" className="agenda-grid rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm sm:p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--reception)]">Agenda</p>
        <form className="mt-5 grid gap-3" onSubmit={addAppointment}>
          <label className="grid gap-2 text-sm font-semibold">
            Cliente
            <select className="min-h-12 rounded-2xl border border-[var(--line)] bg-white/70 px-4 text-base font-medium" name="client_id" required>
              <option value="">Seleccionar</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Servicio
            <select className="min-h-12 rounded-2xl border border-[var(--line)] bg-white/70 px-4 text-base font-medium" name="service_id" required>
              <option value="">Seleccionar</option>
              {services.filter((service) => service.is_active).map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
            </select>
          </label>
          <Field label="Fecha y hora" name="starts_at" type="datetime-local" />
          <SubmitButton disabled={disabled} pending={pending}>Crear cita</SubmitButton>
          {disabled ? <FormMessage type="error">Activa el plan mensual para crear citas y gestionar señas.</FormMessage> : null}
          {message ? <FormMessage type="error">{message}</FormMessage> : null}
        </form>
        <div className="mt-5 grid gap-3">
          {appointments.length === 0 ? <EmptyState title="Agenda vacia" text="Crea una cita para ver la linea de agenda." /> : null}
          {appointments.map((appointment) => (
            <article className="rounded-2xl border border-[var(--line)] bg-white/70 p-4" key={appointment.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="number-tabular text-sm font-semibold text-[var(--ink-muted)]">{formatAppointmentTime(appointment.starts_at)}</p>
                  <p className="mt-1 font-semibold">{appointment.services?.name ?? "Servicio"}</p>
                  <p className="mt-1 text-sm text-[var(--ink-soft)]">{appointment.clients?.name ?? "Cliente"}</p>
                  {appointment.status === "pending_payment" && appointment.deposit_amount_cents > 0 ? (
                    <p className="mt-2 text-sm font-semibold text-[var(--terracotta)]">
                      Seña pendiente: {formatCurrency(appointment.deposit_amount_cents, business.currency)}
                      {appointment.deposit_expires_at ? ` · vence ${new Date(appointment.deposit_expires_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}` : ""}
                    </p>
                  ) : null}
                </div>
                <select className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-xs font-semibold" disabled={disabled} value={appointment.status} onChange={(event) => updateAppointmentStatus(appointment, event.target.value as Appointment["status"])}>
                  <option value="pending_payment">Pendiente seña</option>
                  <option value="confirmed">Confirmada</option>
                  <option value="cancelled">Cancelada</option>
                  <option value="completed">Completada</option>
                  <option value="no_show">No asistio</option>
                </select>
              </div>
              {appointment.status === "pending_payment" && appointment.deposit_amount_cents > 0 ? (
                <button className="mt-4 rounded-full bg-[var(--reception)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={disabled} onClick={() => confirmDeposit(appointment)} type="button">
                  Confirmar seña recibida
                </button>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--line-strong)] bg-white/40 p-5">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-6 text-[var(--ink-soft)]">{text}</p>
    </div>
  );
}
