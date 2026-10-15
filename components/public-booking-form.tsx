"use client";

import { FormEvent, useMemo, useRef, useState, type CSSProperties } from "react";
import { PublicBookingCalendar } from "@/components/public-booking-calendar";
import { PublicServiceCarousel } from "@/components/public-service-carousel";
import {
  buildBookingSlots,
  formatCurrency,
  getBookingAmountCents,
  type PublicBusiness,
  type Service,
  type ServiceAvailabilitySlot,
} from "@/lib/citadely-db";
import { getErrorMessage } from "@/lib/auth";
import { getWhatsAppUrl } from "@/lib/public-profile";
import { normalizePublicTheme, resolveSectionColors, sectionThemeStyle } from "@/lib/public-theme";
import { formatInTimeZone } from "@/lib/time";
import { WhatsAppIcon } from "@/components/public-business-info";
import { Field, FormMessage, SubmitButton } from "@/components/ui";

export function PublicBookingForm({
  business,
  services,
  availabilitySlots,
}: {
  business: PublicBusiness;
  services: Service[];
  availabilitySlots: ServiceAvailabilitySlot[];
}) {
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const calendarHeadingRef = useRef<HTMLHeadingElement>(null);
  const [selectedDateKey, setSelectedDateKey] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [localReservations, setLocalReservations] = useState<Record<string, number>>({});

  const selectedService = services.find((service) => service.id === selectedServiceId) ?? null;
  const slots = useMemo(
    () => buildBookingSlots([], selectedService, availabilitySlots, business.timezone).map((slot) => {
      const localCount = localReservations[`${selectedService?.id}:${slot.startsAt}`] ?? 0;
      const remaining = Math.max(0, slot.remaining - localCount);
      return { ...slot, booked: slot.booked + localCount, remaining, available: remaining > 0 };
    }),
    [selectedService, availabilitySlots, business.timezone, localReservations],
  );
  const selectedSlotData = slots.find((slot) => slot.startsAt === selectedSlot) ?? null;
  const selectedAmountCents = selectedService ? getBookingAmountCents(selectedService) : 0;
  const whatsAppUrl = getWhatsAppUrl(
    business.whatsapp_phone,
    `Hola ${business.name}, quiero enviar el comprobante de seña para ${selectedService?.name ?? "mi reserva"}${selectedSlotData ? ` del ${selectedSlotData.label}` : ""}.`,
  );
  const brandColor = business.brand_color || "#0957d9";
  const publicTheme = normalizePublicTheme(business.public_theme);
  const bookingStyle = sectionThemeStyle("booking", publicTheme, brandColor);
  const servicesStyle = sectionThemeStyle("services", publicTheme, brandColor);
  const servicesColors = resolveSectionColors("services", publicTheme, brandColor);

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
    const depositDeadline = bookingData?.deposit_expires_at
      ? formatInTimeZone(bookingData.deposit_expires_at, business.timezone, {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        })
      : null;

    setLocalReservations((current) => ({ ...current, [`${selectedService.id}:${selectedSlot}`]: (current[`${selectedService.id}:${selectedSlot}`] ?? 0) + 1 }));
    setPending(false);
    setSuccess(
      amountCents > 0
        ? `Pre-reserva creada. Transferí ${formatCurrency(amountCents, business.currency)} antes del vencimiento y el negocio confirmará tu turno cuando reciba la seña.${depositDeadline ? ` Vence el ${depositDeadline}.` : " El plazo máximo es de 2 horas."}`
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
      className={`grid min-w-0 gap-x-10 gap-y-9 lg:grid-cols-[minmax(0,1fr)_340px] ${bookingStyle ? "public-theme-active public-theme-booking" : ""}`}
      onSubmit={reserveAppointment}
      style={bookingStyle ?? { "--booking-brand": brandColor } as CSSProperties}
    >
      {error || success ? <div className="lg:col-span-2">
        {error ? <FormMessage type="error">{error}</FormMessage> : null}
        {success ? <FormMessage type="success">{success}</FormMessage> : null}
      </div> : null}

      <section className={`public-service-section min-w-0 lg:col-span-2 ${servicesStyle ? "public-theme-active public-theme-services" : ""}`} style={{ ...servicesStyle, "--booking-brand": servicesColors.accent, "--booking-brand-foreground": servicesColors.accentInk } as CSSProperties}>
        <div className="public-catalog-heading">
          <div>
            <div className="flex items-center gap-3"><span aria-hidden="true" className="public-booking-step">01</span><h2 className="font-display text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Servicios</h2></div>
            <p className="mt-3 text-sm text-[var(--color-ink-soft)]">Abrí el detalle para elegir el servicio que querés reservar.</p>
          </div>
        </div>
          <div className="mt-6">
            <PublicServiceCarousel
              brandColor={servicesColors.accent}
              currency={business.currency}
              onSelect={(id) => {
                if (id !== selectedServiceId) {
                  setSelectedServiceId(id);
                  setSelectedDateKey("");
                  setSelectedSlot("");
                }
                requestAnimationFrame(() => calendarHeadingRef.current?.focus());
              }}
              selectedServiceId={selectedServiceId}
              services={services}
            />
          </div>
      </section>

      <PublicBookingCalendar
        headingRef={calendarHeadingRef}
        key={selectedServiceId || "empty"}
        onDateChange={setSelectedDateKey}
        onSlotChange={setSelectedSlot}
        selectedDateKey={selectedDateKey}
        selectedSlot={selectedSlot}
        serviceSelected={Boolean(selectedService)}
        slots={slots}
        timeZone={business.timezone}
      />

      <section className="public-theme-card public-booking-summary h-fit border border-[var(--color-line)] bg-white p-5 sm:p-6 lg:sticky lg:top-6">
        <div className="flex items-center gap-3"><span aria-hidden="true" className="public-booking-step">03</span><h2 className="font-display text-2xl font-semibold tracking-[-0.03em]">Confirmá la reserva</h2></div>
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
        {selectedService && selectedAmountCents > 0 ? (
          <div className="mt-5 rounded-md border border-[var(--color-warning)] bg-[var(--color-warning-soft)] p-4 text-sm leading-6 text-[var(--color-ink-soft)]">
            <p className="font-semibold text-[var(--color-ink)]">Datos para transferir la seña</p>
            {business.payment_alias ? <p className="mt-2">Alias: <strong>{business.payment_alias}</strong></p> : null}
            {business.payment_cbu ? <p>CBU/CVU: <strong>{business.payment_cbu}</strong></p> : null}
            {business.payment_instructions ? <p className="mt-2">{business.payment_instructions}</p> : null}
            {!business.payment_alias && !business.payment_cbu ? <p className="mt-2">El negocio todavía no cargó alias o CBU/CVU. Reservá y coordiná el pago directamente con el negocio.</p> : null}
            <p className="mt-2">La pre-reserva vence en un máximo de 2 horas, o al comenzar el turno si ocurre antes.</p>
            {whatsAppUrl ? <a className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md bg-[#148b45] px-4 text-sm font-bold text-white hover:bg-[#0e7438]" href={whatsAppUrl} rel="noreferrer" target="_blank"><WhatsAppIcon />Enviar comprobante por WhatsApp</a> : null}
          </div>
        ) : null}
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
