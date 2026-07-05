import Link from "next/link";
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
      <main className="flex min-h-screen items-center justify-center bg-[var(--agenda-paper)] px-5">
        <section className="max-w-xl rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-8 text-center shadow-sm">
          <LogoMark />
          <h1 className="mt-8 text-3xl font-semibold tracking-[-0.05em]">Página no disponible</h1>
          <p className="mt-3 text-[var(--ink-soft)]">
            No encontramos un negocio público con esta dirección.
          </p>
          <Link className="mt-6 inline-flex rounded-full bg-[var(--reception)] px-5 py-3 text-sm font-semibold text-white" href="/">
            Volver a Citadely
          </Link>
        </section>
      </main>
    );
  }

  const business = businessData as Business;
  const subscription = getSubscriptionState(business);
  const [{ data: serviceRows }, { data: appointmentRows }, { data: availabilityRows }] = await Promise.all([
    insforge.database
      .from("services")
      .select("*")
      .eq("business_id", business.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
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
  const brandColor = business.brand_color || "#286f5b";
  const categoryLabel = business.category.replaceAll("_", " ");
  const weekdayNames = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
  const availableDateCount = new Set(availabilitySlots.map((slot) => new Date(slot.starts_at).toISOString().slice(0, 10))).size;
  const attentionSummary =
    availabilitySlots.length > 0
      ? `${availableDateCount} dia${availableDateCount === 1 ? "" : "s"} con turnos publicados. Elegi un servicio para ver horarios exactos.`
      : "Todavia no hay horarios publicados. Volve a revisar pronto o contacta al negocio.";

  return (
    <main className="min-h-screen bg-[#f6f0e6] px-5 py-6 text-[var(--ink)] sm:px-8">
      <div className="mx-auto grid max-w-7xl gap-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <LogoMark />
          <Link className="rounded-full border border-[var(--line)] bg-white/75 px-4 py-2 text-sm font-semibold shadow-sm" href="/login">
            Soy el negocio
          </Link>
        </header>

        <section className="overflow-hidden rounded-[2.25rem] border border-[var(--line)] bg-[var(--surface)] shadow-[0_24px_80px_rgba(36,33,29,0.08)]">
          {pago ? (
            <div className="m-6 rounded-2xl border border-[var(--line)] bg-white/80 p-4 text-sm font-semibold text-[var(--ink-soft)]">
              {pago === "aprobado"
                ? "Pago aprobado. Tu cita quedo confirmada."
                : pago === "fallido"
                  ? "El pago no se completo. Podes intentar reservar nuevamente."
                  : "El pago quedo pendiente de confirmacion."}
            </div>
          ) : null}
          <div className="relative">
            <div
              className="relative min-h-[430px] overflow-hidden bg-cover bg-center sm:min-h-[470px]"
              style={{
                backgroundColor: brandColor,
                backgroundImage: business.cover_image_url
                  ? `linear-gradient(90deg, rgba(8,14,12,.86), rgba(8,14,12,.58) 45%, rgba(8,14,12,.28)), linear-gradient(180deg, rgba(0,0,0,.12), rgba(0,0,0,.52)), url(${business.cover_image_url})`
                  : `radial-gradient(circle at 18% 20%, rgba(255,255,255,.22), transparent 32%), linear-gradient(135deg, ${brandColor}, #17231f 76%)`,
              }}
            >
              <div className="absolute inset-0 agenda-grid opacity-20" />
              <div className="absolute inset-x-0 bottom-0 p-5 pb-24 sm:p-8 sm:pb-28 lg:p-10 lg:pb-32">
                <div className="max-w-3xl text-white">
                  <p className="inline-flex rounded-full border border-white/20 bg-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] shadow-sm backdrop-blur">
                    Reserva online · {categoryLabel}
                  </p>
                  <h1 className="mt-5 text-4xl font-semibold leading-none tracking-[-0.07em] drop-shadow-sm sm:text-7xl">
                    {business.name}
                  </h1>
                  <p className="mt-5 max-w-2xl text-base leading-7 text-white/82 sm:text-lg">
                    {business.description || "Elegí un servicio, revisá el calendario disponible y confirmá tu turno sin crear cuenta."}
                  </p>
                  <div className="mt-7 flex flex-wrap gap-3">
                    <a className="inline-flex min-h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-bold text-[var(--ink)] shadow-sm hover:-translate-y-0.5" href="#reservar">
                      Reservar turno
                    </a>
                    <span className="inline-flex min-h-12 items-center rounded-full border border-white/20 bg-white/12 px-5 text-sm font-semibold text-white/85 backdrop-blur">
                      Confirmación por email
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-5 p-5 pt-5 sm:p-8 sm:pt-6 lg:grid-cols-[1fr_390px] lg:p-10 lg:pt-6">
              <div className="relative -mt-6 rounded-[2rem] border border-[var(--line)] bg-white/88 p-5 shadow-sm backdrop-blur sm:-mt-8 sm:p-6 lg:-mt-10">
                <span className="absolute inset-x-8 top-0 h-1 rounded-b-full" style={{ background: `linear-gradient(90deg, transparent, ${brandColor}, transparent)` }} />
                <div className="flex flex-wrap items-end gap-4">
                  <div className="grid h-28 w-28 shrink-0 place-items-center overflow-hidden rounded-[2rem] border-4 border-white bg-[var(--surface-raised)] shadow-sm sm:h-32 sm:w-32">
                    {business.logo_url ? (
                      <span
                        aria-label={`${business.name} logo`}
                        className="block h-full w-full bg-cover bg-center"
                        role="img"
                        style={{ backgroundImage: `url(${business.logo_url})` }}
                      />
                    ) : (
                      <span className="text-5xl font-semibold tracking-[-0.08em]" style={{ color: brandColor }}>
                        {business.name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">Perfil del negocio</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em] sm:text-3xl">{business.name}</h2>
                    <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
                      Página oficial de reservas. Seleccioná servicio, día y horario disponible.
                    </p>
                  </div>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <span className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 text-sm font-semibold">
                    <span className="block text-2xl tracking-[-0.05em]">{services.length}</span>
                    servicios activos
                  </span>
                  <span className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 text-sm font-semibold">
                    <span className="block text-2xl tracking-[-0.05em]">{formatCurrency(minPrice, business.currency)}</span>
                    precio desde
                  </span>
                  <span className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 text-sm font-semibold">
                    <span className="block text-2xl tracking-[-0.05em]">{availableDateCount}</span>
                    días publicados
                  </span>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-[2rem] border border-[var(--line)] bg-[var(--ink)] p-6 text-white shadow-sm lg:-mt-10">
                <span className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(circle at 82% 8%, ${brandColor}, transparent 42%)` }} />
                <span className="absolute right-5 top-5 h-10 w-10 rounded-full opacity-80" style={{ backgroundColor: brandColor }} />
                <p className="relative text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Atención</p>
                <p className="relative mt-3 max-w-xs text-2xl font-semibold tracking-[-0.04em]">Días y horarios publicados</p>
                <p className="relative mt-4 text-sm leading-6 text-white/70">{attentionSummary}</p>
                <div className="relative mt-7 rounded-3xl border border-white/10 bg-[#f8f3ea] p-2 text-[var(--ink)]">
                  <div className="grid grid-cols-7 gap-1">
                    {weekdayNames.map((weekday) => (
                      <span className="rounded-2xl px-2 py-3 text-center text-xs font-semibold text-[var(--ink-muted)]" key={weekday}>
                        {weekday}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-3 rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm sm:grid-cols-3 sm:p-6">
          {[
            ["1", "Elegí servicio", "Compará duración, precio y condiciones antes de reservar."],
            ["2", "Seleccioná horario", "Solo mostramos turnos publicados y todavía disponibles."],
            ["3", "Confirmá tus datos", "Recibís el detalle por email; si hay seña, enviás comprobante."],
          ].map(([step, title, text]) => (
            <article className="rounded-[1.35rem] border border-[var(--line)] bg-white/60 p-4" key={step}>
              <span className="grid h-9 w-9 place-items-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: brandColor }}>{step}</span>
              <h2 className="mt-4 text-lg font-semibold tracking-[-0.04em]">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">{text}</p>
            </article>
          ))}
        </section>

        {subscription.hasAccess ? (
          <div id="reservar">
            <PublicBookingForm appointments={appointments} availabilitySlots={availabilitySlots} business={business} services={services} />
          </div>
        ) : (
          <div id="reservar" className="rounded-[2rem] border border-dashed border-[var(--line-strong)] bg-[var(--surface)] p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--danger)]">Plan inactivo</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">Reservas pausadas temporalmente</h2>
            <p className="mt-3 text-[var(--ink-soft)]">
              Este negocio todavía no puede recibir reservas online. Podés volver más tarde o contactarlo por sus canales habituales.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
