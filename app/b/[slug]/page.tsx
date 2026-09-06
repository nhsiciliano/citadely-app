import type { CSSProperties } from "react";
import Link from "next/link";
import { CalendarDays, CheckCircle2, Clock3 } from "lucide-react";
import { PublicBookingForm } from "@/components/public-booking-form";
import { LogoMark } from "@/components/ui";
import {
  formatCurrency,
  getSubscriptionState,
  type Appointment,
  type Business,
  type Service,
  type ServiceAvailabilitySlot,
} from "@/lib/citadely-db";
import { insforge } from "@/lib/insforge";

export default async function PublicBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ pago?: string }>;
}) {
  const { slug } = await params;
  const { pago } = await searchParams;
  const { data: businessData } = await insforge.database
    .from("businesses")
    .select("*")
    .eq("slug", slug)
    .eq("is_public", true)
    .maybeSingle();

  if (!businessData) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--color-canvas)] px-5">
        <section className="max-w-xl border border-[var(--color-line)] bg-white p-8 text-center shadow-[var(--shadow-surface)]">
          <LogoMark />
          <h1 className="font-display mt-8 text-3xl font-semibold tracking-[-0.04em]">Página no disponible</h1>
          <p className="mt-3 text-[var(--color-ink-soft)]">No encontramos un negocio público con esta dirección.</p>
          <Link className="button-primary mt-6" href="/">Volver a Citadely</Link>
        </section>
      </main>
    );
  }

  const business = businessData as Business;
  const isDemoBusiness = business.slug === "citadely-demo-ux";
  const subscription = getSubscriptionState(business);
  const [{ data: serviceRows }, { data: appointmentRows }, { data: availabilityRows }] = await Promise.all([
    insforge.database.from("services").select("*").eq("business_id", business.id).eq("is_active", true).order("created_at", { ascending: false }),
    insforge.database
      .from("appointments")
      .select("id,business_id,client_id,service_id,employee_id,starts_at,ends_at,status,source,client_message")
      .eq("business_id", business.id)
      .gte("starts_at", new Date().toISOString())
      .neq("status", "cancelled")
      .order("starts_at", { ascending: true }),
    insforge.database
      .from("service_availability_slots")
      .select("*")
      .eq("business_id", business.id)
      .eq("is_active", true)
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true }),
  ]);

  const services = (serviceRows ?? []) as Service[];
  const appointments = (appointmentRows ?? []) as Appointment[];
  const availabilitySlots = (availabilityRows ?? []) as ServiceAvailabilitySlot[];
  const minPrice = services.length > 0 ? Math.min(...services.map((service) => service.price_cents)) : 0;
  const brandColor = business.brand_color || "#0957d9";
  const categoryLabel = business.category.replaceAll("_", " ");
  const availableDateCount = new Set(availabilitySlots.map((slot) => new Date(slot.starts_at).toISOString().slice(0, 10))).size;
  const attentionSummary = availabilitySlots.length > 0
    ? `${availableDateCount} día${availableDateCount === 1 ? "" : "s"} con turnos publicados. Elegí un servicio para ver los horarios exactos.`
    : "Todavía no hay horarios publicados. Volvé a revisar pronto o contactá al negocio.";

  return (
    <main className="min-h-screen bg-[var(--color-canvas)] text-[var(--color-ink)]" style={{ "--booking-brand": brandColor } as CSSProperties}>
      <a className="skip-link" href="#reservar">Ir a reservar</a>
      <header className="border-b border-[var(--color-line)] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md border border-[var(--color-line)] bg-white">
              {business.logo_url ? (
                <span aria-label={`Logo de ${business.name}`} className="block h-full w-full bg-cover bg-center" role="img" style={{ backgroundImage: `url(${business.logo_url})` }} />
              ) : (
                <span className="font-display text-lg font-semibold" style={{ color: brandColor }}>{business.name.slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{business.name}</p>
              <p className="text-xs capitalize text-[var(--color-ink-muted)]">{isDemoBusiness ? "Demostración · datos ficticios" : `Reservas · ${categoryLabel}`}</p>
            </div>
          </div>
          <Link className="button-secondary" href="/login">Acceso del negocio</Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-6 sm:px-8 sm:py-8">
        <section className="overflow-hidden border border-[var(--color-line)] bg-white shadow-[var(--shadow-surface)]">
          {pago ? (
            <div className="m-5 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-subtle)] p-4 text-sm font-semibold text-[var(--color-ink-soft)] sm:m-6">
              {pago === "aprobado"
                ? "Pago aprobado. Tu turno quedó confirmado."
                : pago === "fallido"
                  ? "El pago no se completó. Podés intentar reservar nuevamente."
                  : "El pago quedó pendiente de confirmación."}
            </div>
          ) : null}

          <div className="grid lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,.6fr)]">
            <div className="relative min-h-[390px] overflow-hidden bg-cover bg-center sm:min-h-[470px]" style={{ backgroundColor: brandColor, backgroundImage: business.cover_image_url ? `url(${business.cover_image_url})` : undefined }}>
              <div className="absolute inset-0 bg-[rgba(4,20,42,.62)]" />
              <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10">
                <div className="max-w-2xl text-white">
                  <h1 className="font-display text-4xl font-semibold leading-[.95] tracking-[-0.055em] sm:text-6xl">{business.name}</h1>
                  <p className="mt-5 max-w-xl text-base leading-7 text-white/85 sm:text-lg">{business.description || "Reserva online: elegí un servicio, revisá el calendario disponible y confirmá tu turno sin crear cuenta."}</p>
                  <a className="mt-7 inline-flex min-h-12 items-center justify-center rounded-md bg-white px-6 text-sm font-bold text-[var(--color-ink)] hover:bg-[var(--color-surface-subtle)]" href="#reservar">Ver turnos disponibles</a>
                </div>
              </div>
            </div>

            <aside className="flex flex-col justify-between border-t border-[var(--color-line)] p-6 lg:border-l lg:border-t-0 lg:p-8">
              <div>
                <h2 className="font-display text-3xl font-semibold tracking-[-0.045em]">Disponibilidad para tu próximo turno, sin llamadas.</h2>
                <p className="mt-4 text-sm leading-6 text-[var(--color-ink-soft)]">{attentionSummary}</p>
              </div>
              <div className="mt-8 grid gap-3 border-t border-[var(--color-line)] pt-6 text-sm">
                <p className="flex items-center gap-3"><CalendarDays aria-hidden="true" className="text-[var(--booking-brand)]" size={18} /><strong>{availableDateCount}</strong> días publicados</p>
                <p className="flex items-center gap-3"><Clock3 aria-hidden="true" className="text-[var(--booking-brand)]" size={18} />Horarios en tiempo real</p>
                <p className="flex items-center gap-3"><CheckCircle2 aria-hidden="true" className="text-[var(--booking-brand)]" size={18} />Confirmación por email</p>
              </div>
            </aside>
          </div>

          <div className="grid border-t border-[var(--color-line)] sm:grid-cols-3">
            <div className="border-b border-[var(--color-line)] p-5 sm:border-b-0 sm:border-r"><strong className="font-mono text-xl">{services.length}</strong><span className="mt-1 block text-xs text-[var(--color-ink-soft)]">servicios activos</span></div>
            <div className="border-b border-[var(--color-line)] p-5 sm:border-b-0 sm:border-r"><strong className="font-mono text-xl">{formatCurrency(minPrice, business.currency)}</strong><span className="mt-1 block text-xs text-[var(--color-ink-soft)]">precio desde</span></div>
            <div className="p-5"><strong className="font-mono text-xl">{availableDateCount}</strong><span className="mt-1 block text-xs text-[var(--color-ink-soft)]">días con turnos</span></div>
          </div>
        </section>

        <section aria-label="Cómo reservar" className="grid border border-[var(--color-line)] bg-white shadow-[var(--shadow-surface)] sm:grid-cols-3">
          {[
            ["01", "Elegí servicio", "Compará duración, precio y condiciones."],
            ["02", "Seleccioná horario", "Solo ves turnos todavía disponibles."],
            ["03", "Confirmá tus datos", "Recibís el detalle por email."],
          ].map(([step, title, text]) => (
            <article className="border-b border-[var(--color-line)] p-5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0" key={step}>
              <span className="font-mono text-xs font-bold text-[var(--booking-brand)]">{step}</span>
              <h2 className="mt-3 font-semibold">{title}</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--color-ink-soft)]">{text}</p>
            </article>
          ))}
        </section>

        {subscription.hasAccess ? (
          <div id="reservar"><PublicBookingForm appointments={appointments} availabilitySlots={availabilitySlots} business={business} services={services} /></div>
        ) : (
          <div className="border border-dashed border-[var(--color-line-strong)] bg-white p-6 shadow-[var(--shadow-surface)]" id="reservar">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-danger)]">Plan inactivo</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">Reservas pausadas temporalmente</h2>
            <p className="mt-3 text-[var(--color-ink-soft)]">Este negocio todavía no puede recibir reservas online. Podés volver más tarde o contactarlo por sus canales habituales.</p>
          </div>
        )}

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-line)] py-5 text-xs text-[var(--color-ink-muted)]">
          <p>Página de reservas de {business.name}</p>
          <Link className="scale-90 font-semibold origin-right hover:text-[var(--color-primary)]" href="/" aria-label="Gestionado con Citadely"><LogoMark linked={false} /></Link>
        </footer>
      </div>
    </main>
  );
}
