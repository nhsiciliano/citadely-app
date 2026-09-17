"use client";

import { FormEvent, useMemo, useState, type CSSProperties } from "react";
import { Check } from "lucide-react";
import {
  buildBookingSlots,
  formatCurrency,
  getBookingAmountCents,
  getBookingPaymentLabel,
  type Appointment,
  type PublicBusiness,
  type Service,
  type ServiceAvailabilitySlot,
} from "@/lib/citadely-db";
import { getErrorMessage } from "@/lib/auth";
import { getWhatsAppUrl } from "@/lib/public-profile";
import { WhatsAppIcon } from "@/components/public-business-info";
import { Field, FormMessage, SubmitButton } from "@/components/ui";

function formatCalendarDate(dateKey: string) {
  const [, month, day] = dateKey.split("-");
  return `${day}/${month}`;
}


export function PublicBookingForm({
  business,
  services,
  appointments,
  availabilitySlots,
}: {
  business: PublicBusiness;
  services: Service[];
  appointments: Appointment[];
  availabilitySlots: ServiceAvailabilitySlot[];
}) {
  const [selectedServiceId, setSelectedServiceId] = useState(services[0]?.id ?? "");
  const [selectedDateKey, setSelectedDateKey] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedService = services.find((service) => service.id === selectedServiceId) ?? null;
  const slots = useMemo(
    () => buildBookingSlots(appointments, selectedService, availabilitySlots),
    [appointments, selectedService, availabilitySlots],
  );
  const availableSlots = slots.filter((slot) => slot.available);
  const calendarDays = useMemo(() => {
    const byDay = new Map<string, typeof availableSlots>();
    for (const slot of availableSlots) {
      byDay.set(slot.dateKey, [...(byDay.get(slot.dateKey) ?? []), slot]);
    }
    return Array.from(byDay.entries()).map(([dateKey, daySlots]) => ({
      dateKey,
      dateLabel: formatCalendarDate(dateKey),
      weekdayLabel: daySlots[0]?.weekdayLabel ?? "",
      slots: daySlots,
    }));
  }, [availableSlots]);
  const selectedDay =
    (selectedDateKey ? calendarDays.find((day) => day.dateKey === selectedDateKey) : null) ?? calendarDays[0] ?? null;
  const selectedDaySlots = selectedDay?.slots ?? [];
  const selectedSlotData = slots.find((slot) => slot.startsAt === selectedSlot) ?? null;
  const selectedAmountCents = selectedService ? getBookingAmountCents(selectedService) : 0;
  const serviceSlotCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const service of services) {
      counts.set(service.id, buildBookingSlots(appointments, service, availabilitySlots).filter((slot) => slot.available).length);
    }
    return counts;
  }, [appointments, availabilitySlots, services]);
  const whatsAppUrl = getWhatsAppUrl(
    business.whatsapp_phone,
    `Hola ${business.name}, quiero enviar el comprobante de seña para ${selectedService?.name ?? "mi reserva"}${selectedSlotData ? ` del ${selectedSlotData.label}` : ""}.`,
  );

  async function reserveAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setPending(true);
    setError(null);
    setSuccess(null);

    if (!selectedService || !selectedSlot) {
      setPending(false);
      setError("Elegí un servicio y un horario disponible.");
      return;
    }

    const form = new FormData(formElement);
    const startsAt = new Date(selectedSlot);
    const response = await fetch("/api/public-booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId: business.id,
        serviceId: selectedService.id,
        startsAt: startsAt.toISOString(),
        clientName: String(form.get("name") ?? ""),
        clientEmail: String(form.get("email") ?? ""),
        clientPhone: String(form.get("phone") ?? ""),
        clientMessage: String(form.get("message") ?? ""),
      }),
    });
    const bookingData = (await response.json().catch(() => null)) as
      | {
          amount_cents?: number | null;
          deposit_expires_at?: string | null;
          status?: string | null;
          error?: string | null;
        }
      | null;

    if (!response.ok) {
      setPending(false);
      setError(bookingData?.error ? getErrorMessage(bookingData.error) : "No pudimos crear la reserva.");
      return;
    }

    const amountCents = bookingData?.amount_cents ?? getBookingAmountCents(selectedService);

    setPending(false);
    setSuccess(
      amountCents > 0
        ? `Pre-reserva creada. Transferí ${formatCurrency(amountCents, business.currency)} en los próximos 30 minutos y el negocio confirmará tu turno cuando reciba la seña.${bookingData?.deposit_expires_at ? ` Vence ${new Date(bookingData.deposit_expires_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}.` : ""}`
        : "Reserva confirmada. Te enviamos los datos del turno por email y el negocio ya puede verla en su agenda.",
    );
    formElement.reset();
    setSelectedSlot("");
  }

  if (services.length === 0) {
    return (
      <div className="border border-dashed border-[var(--color-line-strong)] bg-white p-6 shadow-[var(--shadow-surface)]">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-violet)]">Sin servicios publicados</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">Reservas online aún no disponibles</h2>
        <p className="mt-3 text-[var(--color-ink-soft)]">
          El negocio todavía está preparando su agenda pública. Volvé pronto para elegir servicio, día y horario.
        </p>
      </div>
    );
  }

  return (
    <form
      className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_390px]"
      onSubmit={reserveAppointment}
      style={{ "--booking-brand": business.brand_color || "#0957d9" } as CSSProperties}
    >
      <div className="lg:col-span-2">
        {error ? <FormMessage type="error">{error}</FormMessage> : null}
        {success ? <FormMessage type="success">{success}</FormMessage> : null}
      </div>

      <div className="grid min-w-0 gap-8 lg:contents">
        <section className="min-w-0 border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-surface)] sm:p-7 lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--booking-brand)]">
            01 · Elegí el servicio
          </p>
          <div className="mt-5 grid min-w-0 max-w-full snap-x snap-mandatory grid-flow-col auto-cols-[300px] gap-4 overflow-x-auto pb-3 sm:auto-cols-[540px]">
            {services.map((service) => (
              <button
                aria-pressed={service.id === selectedServiceId}
                className={`group relative grid min-h-[300px] snap-start grid-cols-[38%_1fr] overflow-hidden rounded-md border bg-[var(--color-navy)] text-left text-white transition-[border-color,box-shadow,transform] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--booking-brand)] ${
                  service.id === selectedServiceId
                    ? "-translate-y-0.5 border-transparent shadow-[0_0_0_3px_var(--booking-brand),0_14px_30px_rgba(9,19,38,0.22)]"
                    : "border-[var(--color-navy-raised)] opacity-80 hover:border-[var(--booking-brand)] hover:opacity-100"
                }`}
                key={service.id}
                onClick={() => {
                  setSelectedServiceId(service.id);
                  setSelectedDateKey("");
                  setSelectedSlot("");
                }}
                type="button"
              >
                {service.id === selectedServiceId ? (
                  <span className="absolute right-3 top-3 z-10 inline-flex min-h-9 items-center gap-2 rounded-full bg-white px-3 text-xs font-bold text-[var(--color-navy)] shadow-md">
                    <Check aria-hidden="true" className="size-4 text-[var(--booking-brand)]" strokeWidth={3} />
                    Seleccionado
                  </span>
                ) : null}
                <span className="contents">
                  {service.image_url ? (
                    <span
                      aria-hidden="true"
                      className="block h-full min-h-[300px] w-full bg-cover bg-center"
                      style={{ backgroundImage: `url(${service.image_url})` }}
                    />
                  ) : (
                    <span className="agenda-grid flex h-full min-h-[300px] items-center justify-center bg-[var(--color-navy-raised)] text-6xl font-semibold text-white/70">
                      {service.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="flex min-w-0 flex-col p-5 sm:p-6">
                    <span className="block text-xl font-semibold tracking-[-0.03em] sm:text-2xl">{service.name}</span>
                    <span className="mt-3 inline-flex w-fit rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                      {getBookingPaymentLabel(service, business.currency)}
                    </span>
                    {service.description ? <span className="mt-4 block text-sm leading-6 text-white/70">{service.description}</span> : null}
                    <span className="mt-auto grid grid-cols-2 gap-2 border-t border-white/15 pt-4 text-sm">
                      <span className="rounded-md border border-white/15 px-3 py-2 font-semibold text-white">
                        {formatCurrency(service.price_cents, business.currency)}
                      </span>
                      <span className="rounded-md border border-white/15 px-3 py-2 font-semibold text-white/75">
                        {service.duration_minutes} min
                      </span>
                    </span>
                    <span className="mt-3 block text-sm font-semibold text-white/65">{serviceSlotCount.get(service.id) ?? 0} horarios disponibles</span>
                  </span>
                </span>
              </button>
            ))}
          </div>
          {selectedService && getBookingAmountCents(selectedService) > 0 ? (
            <div className="mt-5 rounded-md border border-[var(--color-warning)] bg-[var(--color-warning-soft)] p-4 text-sm leading-6 text-[var(--color-ink-soft)]">
              <p className="font-semibold text-[var(--color-ink)]">Datos para transferir la seña</p>
              {business.payment_alias ? <p className="mt-2">Alias: <strong>{business.payment_alias}</strong></p> : null}
              {business.payment_cbu ? <p>CBU/CVU: <strong>{business.payment_cbu}</strong></p> : null}
              {business.payment_instructions ? <p className="mt-2">{business.payment_instructions}</p> : null}
              {!business.payment_alias && !business.payment_cbu ? (
                <p className="mt-2">El negocio todavía no cargó alias o CBU/CVU. Reservá y coordiná el pago directamente con el negocio.</p>
              ) : null}
              <p className="mt-2">La pre-reserva se mantiene por 30 minutos hasta que el negocio confirme la seña.</p>
              {whatsAppUrl ? (
                <a
                  className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md bg-[#148b45] px-5 text-sm font-bold text-white hover:bg-[#0e7438]"
                  href={whatsAppUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  <WhatsAppIcon />
                  Enviar comprobante por WhatsApp
                </a>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-surface)] sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--booking-brand)]">
            02 · Calendario
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {calendarDays.length === 0 ? (
              <p className="col-span-full rounded-md border border-dashed border-[var(--color-line-strong)] bg-[var(--color-surface-subtle)] p-5 text-sm leading-6 text-[var(--color-ink-soft)]">
                Este servicio no tiene horarios disponibles ahora. Probá otro servicio o volvé cuando el negocio publique nueva agenda.
              </p>
            ) : null}
            {calendarDays.map((day) => (
              <button
                  className={`min-h-20 rounded-md border px-3 py-4 text-center ${
                  day.dateKey === selectedDay?.dateKey
                    ? "border-[var(--booking-brand)] bg-[var(--booking-brand)] text-white"
                    : "border-[var(--color-line)] bg-white text-[var(--color-ink)] hover:border-[var(--color-line-strong)]"
                }`}
                key={day.dateKey}
                onClick={() => {
                  setSelectedDateKey(day.dateKey);
                  setSelectedSlot("");
                }}
                type="button"
              >
                <span className="block text-xs font-semibold uppercase tracking-[0.12em] opacity-70">{day.weekdayLabel}</span>
                <span className="mt-1 block text-lg font-semibold tracking-[-0.03em]">{day.dateLabel}</span>
                <span className="mt-2 block text-xs font-semibold opacity-70">{day.slots.length} turnos</span>
              </button>
            ))}
          </div>

          {selectedDay ? (
            <div className="mt-6">
              <p className="text-sm font-semibold text-[var(--color-ink-soft)]">
                Horarios para {selectedDay.weekdayLabel} {selectedDay.dateLabel}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {selectedDaySlots.map((slot) => (
                  <button
                    className={`min-h-12 rounded-md border px-4 py-3 text-center font-mono text-sm font-semibold ${
                      slot.startsAt === selectedSlot
                        ? "border-[var(--booking-brand)] bg-[var(--booking-brand)] text-white"
                        : "border-[var(--color-line)] bg-white text-[var(--color-ink)] hover:border-[var(--color-line-strong)]"
                    }`}
                    key={slot.startsAt}
                    onClick={() => setSelectedSlot(slot.startsAt)}
                    type="button"
                  >
                    {slot.timeLabel}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <section className="h-fit border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-raised)] sm:p-6 lg:sticky lg:top-6">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--booking-brand)]">
          03 · Confirmá
        </p>
        <div className="mt-5 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-subtle)] p-4">
          <p className="text-sm font-semibold text-[var(--color-ink-soft)]">Tu turno</p>
          <p className="mt-2 text-xl font-semibold tracking-[-0.04em]">
            {selectedService?.name ?? "Seleccioná un servicio"}
          </p>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            {selectedSlotData ? `${selectedSlotData.label} · ${selectedService?.duration_minutes ?? 0} min` : "Elegí día y horario en el calendario"}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <span className="rounded-md bg-white p-3 font-semibold">
              <span className="block text-xs uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">Precio</span>
              {selectedService ? formatCurrency(selectedService.price_cents, business.currency) : "-"}
            </span>
            <span className="rounded-md bg-white p-3 font-semibold">
              <span className="block text-xs uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">Al reservar</span>
              {selectedService ? selectedAmountCents > 0 ? formatCurrency(selectedAmountCents, business.currency) : "Sin seña" : "-"}
            </span>
          </div>
        </div>
        <div className="mt-5 grid gap-4">
          <Field autoComplete="name" label="Nombre y apellido" name="name" placeholder="Tu nombre y apellido" />
          <Field autoComplete="email" label="Email" name="email" placeholder="tu@email.com" type="email" />
          <Field autoComplete="tel" label="Teléfono" name="phone" placeholder="Tu teléfono" type="tel" />
          <Field label="Nota para el negocio" name="message" placeholder="Opcional" required={false} />
        </div>
        <p className="mt-4 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-subtle)] px-4 py-3 text-xs font-medium leading-5 text-[var(--color-ink-muted)]">
          Revisá que el email esté bien escrito. Ahí llega la confirmación del turno.
        </p>
        <div className="mt-6">
          <SubmitButton pending={pending}>Confirmar reserva</SubmitButton>
        </div>
      </section>
    </form>
  );
}
